import { app } from 'electron'
import { homedir } from 'os'
import { dirname, join, resolve, sep } from 'path'
import { mkdir, readFile, rm, symlink, writeFile } from 'fs/promises'
import { parse } from 'yaml'
import type {
  AgentUpdateRequest,
  AgentId,
  InstallRequest,
  InstalledSkill,
  OperationResult,
  RemoveRequest,
  SettingsInfo,
  SkillPreview
} from '../shared/skills-types'

type SourceInfo = {
  owner: string
  repo: string
  ref?: string
  subpath?: string
}

type TreeEntry = {
  path: string
  type: 'blob' | 'tree'
  sha: string
}

type GitHubTree = {
  sha: string
  tree: TreeEntry[]
}

type LockEntry = {
  name: string
  source: string
  owner: string
  repo: string
  ref: string
  skillPath: string
  folderSha: string | null
  agents: AgentId[]
  storagePath: string
  installedAt: string
  updatedAt: string
}

type LockFile = {
  version: 1
  skills: Record<string, LockEntry>
}

const AGENTS: Record<AgentId, { displayName: string; dir: () => string }> = {
  'claude-code': {
    displayName: 'Claude Code',
    dir: () => join(process.env.CLAUDE_CONFIG_DIR?.trim() || join(homedir(), '.claude'), 'skills')
  },
  codex: {
    displayName: 'Codex',
    dir: () => join(process.env.CODEX_HOME?.trim() || join(homedir(), '.codex'), 'skills')
  }
}

const PRIORITY_PREFIXES = [
  '',
  'skills/',
  'skills/.curated/',
  'skills/.experimental/',
  'skills/.system/',
  '.agents/skills/',
  '.claude/skills/',
  '.codex/skills/'
]

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '__pycache__'])

export class SkillsService {
  async listGlobal(): Promise<InstalledSkill[]> {
    const lock = await this.readLock()

    return Object.values(lock.skills)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((skill) => ({
        name: skill.name,
        storagePath: skill.storagePath,
        agents: skill.agents,
        source: skill.source,
        updatedAt: skill.updatedAt
      }))
  }

  getSettingsInfo(): SettingsInfo {
    return {
      appDataPath: this.getUserDataPath(),
      agents: (Object.entries(AGENTS) as Array<[AgentId, (typeof AGENTS)[AgentId]]>).map(([id, agent]) => ({
        id,
        label: agent.displayName,
        skillsPath: agent.dir()
      }))
    }
  }

  async previewGitHubSource(source: string): Promise<SkillPreview[]> {
    const sourceInfo = await this.resolveSource(source)
    const tree = await this.fetchTree(sourceInfo)
    return this.parseSkillsFromTree(sourceInfo, tree)
  }

  async install(request: InstallRequest): Promise<OperationResult> {
    const logs: string[] = []

    try {
      const sourceInfo = await this.resolveSource(request.source)
      const tree = await this.fetchTree(sourceInfo)
      const availableSkills = await this.parseSkillsFromTree(sourceInfo, tree)
      const selectedPaths = new Set(request.skills.map((skill) => skill.skillPath))
      const selectedSkills = availableSkills.filter((skill) => selectedPaths.has(skill.skillPath))

      if (selectedSkills.length === 0) {
        return { ok: false, logs: ['No selected skills were found in the source repository.'] }
      }

      const lock = await this.readLock()

      for (const skill of selectedSkills) {
        const skillName = sanitizeName(skill.name)
        const storagePath = this.getSkillStoragePath(skillName)
        logs.push(`Installing ${skill.name} to ${storagePath}`)

        await this.writeSkillFolder(sourceInfo, tree, skill, storagePath)

        for (const agent of request.agents) {
          const linkedPath = join(AGENTS[agent].dir(), skillName)
          await this.linkOrCopy(storagePath, linkedPath)
          logs.push(`Linked ${skill.name} for ${AGENTS[agent].displayName}`)
        }

        const now = new Date().toISOString()
        lock.skills[skillName] = {
          name: skill.name,
          source: formatSource(sourceInfo),
          owner: sourceInfo.owner,
          repo: sourceInfo.repo,
          ref: sourceInfo.ref!,
          skillPath: skill.skillPath,
          folderSha: skill.folderSha,
          agents: request.agents,
          storagePath,
          installedAt: lock.skills[skillName]?.installedAt || now,
          updatedAt: now
        }
      }

      await this.writeLock(lock)
      return { ok: true, logs }
    } catch (error) {
      return { ok: false, logs: [...logs, getErrorMessage(error)] }
    }
  }

  async addAgents(request: AgentUpdateRequest): Promise<OperationResult> {
    const lock = await this.readLock()
    const logs: string[] = []

    for (const name of request.names) {
      const skillName = sanitizeName(name)
      const entry = lock.skills[skillName]

      if (!entry) {
        logs.push(`Skipped ${name}: not installed by this app.`)
        continue
      }

      for (const agent of request.agents) {
        await this.linkOrCopy(entry.storagePath, join(AGENTS[agent].dir(), skillName))
        logs.push(`Linked ${entry.name} for ${AGENTS[agent].displayName}.`)
      }

      entry.agents = Array.from(new Set([...entry.agents, ...request.agents]))
      entry.updatedAt = new Date().toISOString()
    }

    await this.writeLock(lock)
    return { ok: true, logs }
  }

  async update(names: string[]): Promise<OperationResult> {
    const lock = await this.readLock()
    const logs: string[] = []
    let updated = 0

    for (const name of names) {
      const entry = lock.skills[sanitizeName(name)]
      if (!entry) {
        logs.push(`Skipped ${name}: not installed by this app.`)
        continue
      }

      const sourceInfo: SourceInfo = {
        owner: entry.owner,
        repo: entry.repo,
        ref: entry.ref
      }
      const tree = await this.fetchTree(sourceInfo)
      const latestFolderSha = this.getSkillFolderSha(tree, entry.skillPath)

      if (latestFolderSha && latestFolderSha === entry.folderSha) {
        logs.push(`${entry.name} is already up to date.`)
        continue
      }

      const previews = await this.parseSkillsFromTree(sourceInfo, tree)
      const preview = previews.find((skill) => skill.skillPath === entry.skillPath)
      if (!preview) {
        logs.push(`Skipped ${entry.name}: upstream skill path no longer exists.`)
        continue
      }

      await this.writeSkillFolder(sourceInfo, tree, preview, entry.storagePath)
      for (const agent of entry.agents) {
        await this.linkOrCopy(entry.storagePath, join(AGENTS[agent].dir(), sanitizeName(entry.name)))
      }

      entry.folderSha = preview.folderSha
      entry.updatedAt = new Date().toISOString()
      updated += 1
      logs.push(`Updated ${entry.name}.`)
    }

    await this.writeLock(lock)
    return { ok: true, logs: logs.length > 0 ? logs : [`Updated ${updated} skills.`] }
  }

  async remove(request: RemoveRequest): Promise<OperationResult> {
    const lock = await this.readLock()
    const logs: string[] = []

    for (const name of request.names) {
      const skillName = sanitizeName(name)
      const entry = lock.skills[skillName]
      const agents = request.agents.length > 0 ? request.agents : entry?.agents || []

      for (const agent of agents) {
        await rm(join(AGENTS[agent].dir(), skillName), { recursive: true, force: true })
        logs.push(`Removed ${skillName} from ${AGENTS[agent].displayName}.`)
      }

      if (entry) {
        entry.agents = entry.agents.filter((agent) => !agents.includes(agent))

        if (entry.agents.length === 0) {
          await rm(entry.storagePath, { recursive: true, force: true })
          delete lock.skills[skillName]
          logs.push(`Removed ${skillName} from app storage.`)
        } else {
          logs.push(`Kept ${skillName} in app storage for remaining agents.`)
        }
      }
    }

    await this.writeLock(lock)
    return { ok: true, logs }
  }

  private getUserDataPath(): string {
    return app.getPath('userData')
  }

  private getLockPath(): string {
    return join(this.getUserDataPath(), 'skills-lock.json')
  }

  private getSkillStoragePath(skillName: string): string {
    return join(this.getUserDataPath(), 'skills', skillName)
  }

  private async readLock(): Promise<LockFile> {
    try {
      const content = await readFile(this.getLockPath(), 'utf-8')
      const parsed = JSON.parse(content) as LockFile
      if (parsed.version !== 1 || !parsed.skills) return createEmptyLock()
      return parsed
    } catch {
      return createEmptyLock()
    }
  }

  private async writeLock(lock: LockFile): Promise<void> {
    await mkdir(dirname(this.getLockPath()), { recursive: true })
    await writeFile(this.getLockPath(), JSON.stringify(lock, null, 2) + '\n', 'utf-8')
  }

  private async resolveSource(input: string): Promise<SourceInfo> {
    const trimmed = input.trim()
    let owner: string | undefined
    let repo: string | undefined
    let ref: string | undefined
    let subpath: string | undefined

    const urlMatch = trimmed.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/]+)(?:\/(.+))?)?\/?$/)
    const shorthandMatch = trimmed.match(/^([^/]+)\/([^/]+)$/)

    if (urlMatch) {
      owner = urlMatch[1]
      repo = urlMatch[2].replace(/\.git$/, '')
      ref = urlMatch[3]
      subpath = urlMatch[4]
    } else if (shorthandMatch) {
      owner = shorthandMatch[1]
      repo = shorthandMatch[2]
    }

    if (!owner || !repo) {
      throw new Error('Only public GitHub repositories are supported. Use owner/repo or a github.com URL.')
    }

    if (!ref) ref = await this.fetchDefaultBranch(owner, repo)
    return { owner, repo, ref, subpath }
  }

  private async fetchDefaultBranch(owner: string, repo: string): Promise<string> {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`)
    if (!response.ok) throw new Error(`GitHub repository lookup failed: ${response.status}`)
    const data = (await response.json()) as { default_branch?: string }
    if (!data.default_branch) throw new Error('GitHub repository did not return a default branch.')
    return data.default_branch
  }

  private async fetchTree(source: SourceInfo): Promise<GitHubTree> {
    const response = await fetch(
      `https://api.github.com/repos/${source.owner}/${source.repo}/git/trees/${encodeURIComponent(source.ref!)}?recursive=1`
    )
    if (!response.ok) throw new Error(`GitHub tree lookup failed: ${response.status}`)
    return (await response.json()) as GitHubTree
  }

  private async parseSkillsFromTree(source: SourceInfo, tree: GitHubTree): Promise<SkillPreview[]> {
    const paths = findSkillMdPaths(tree.tree, source.subpath)
    const previews: SkillPreview[] = []

    for (const skillPath of paths) {
      const entry = tree.tree.find((item) => item.path === skillPath)
      if (!entry) continue
      const content = await this.fetchRawFile(source, skillPath)
      const metadata = parseSkillMetadata(content.toString('utf-8'))
      previews.push({
        name: metadata.name,
        description: metadata.description,
        skillPath,
        folderSha: this.getSkillFolderSha(tree, skillPath)
      })
    }

    return previews
  }

  private async writeSkillFolder(source: SourceInfo, tree: GitHubTree, skill: SkillPreview, storagePath: string): Promise<void> {
    const skillDir = dirname(skill.skillPath)
    const prefix = skillDir === '.' ? '' : `${skillDir}/`
    const files = tree.tree.filter((entry) => entry.type === 'blob' && (prefix ? entry.path.startsWith(prefix) : true))

    await rm(storagePath, { recursive: true, force: true })
    await mkdir(storagePath, { recursive: true })

    for (const file of files) {
      const relativePath = prefix ? file.path.slice(prefix.length) : file.path
      const targetPath = join(storagePath, relativePath)
      if (!isInside(storagePath, targetPath)) throw new Error(`Unsafe file path from GitHub: ${file.path}`)

      const content = await this.fetchRawFile(source, file.path)
      await mkdir(dirname(targetPath), { recursive: true })
      await writeFile(targetPath, content)
    }

    const skillMd = await readFile(join(storagePath, 'SKILL.md'), 'utf-8')
    const metadata = parseSkillMetadata(skillMd)
    skill.name = metadata.name
    skill.description = metadata.description
  }

  private async fetchRawFile(source: SourceInfo, path: string): Promise<Buffer> {
    const response = await fetch(
      `https://raw.githubusercontent.com/${source.owner}/${source.repo}/${encodeURIComponent(source.ref!)}/${path
        .split('/')
        .map(encodeURIComponent)
        .join('/')}`
    )
    if (!response.ok) throw new Error(`Failed to download ${path}: ${response.status}`)
    return Buffer.from(await response.arrayBuffer())
  }

  private getSkillFolderSha(tree: GitHubTree, skillPath: string): string | null {
    const folderPath = dirname(skillPath)
    if (folderPath === '.') return tree.sha
    return tree.tree.find((entry) => entry.type === 'tree' && entry.path === folderPath)?.sha || null
  }

  private async linkOrCopy(storagePath: string, linkedPath: string): Promise<void> {
    await rm(linkedPath, { recursive: true, force: true })
    await mkdir(dirname(linkedPath), { recursive: true })

    try {
      await symlink(storagePath, linkedPath, process.platform === 'win32' ? 'junction' : 'dir')
    } catch {
      await copyDirectory(storagePath, linkedPath)
    }
  }
}

function createEmptyLock(): LockFile {
  return { version: 1, skills: {} }
}

function findSkillMdPaths(tree: TreeEntry[], subpath?: string): string[] {
  const allSkillMds = tree.filter((entry) => entry.type === 'blob' && entry.path.toLowerCase().endsWith('skill.md')).map((entry) => entry.path)
  const prefix = subpath ? (subpath.endsWith('/') ? subpath : `${subpath}/`) : ''
  const filtered = prefix ? allSkillMds.filter((path) => path.startsWith(prefix)) : allSkillMds
  const results: string[] = []
  const seen = new Set<string>()
  const lowerSkillMdSet = new Set(filtered.map((path) => path.toLowerCase()))

  for (const priorityPrefix of PRIORITY_PREFIXES) {
    const fullPrefix = `${prefix}${priorityPrefix}`
    const isContainer = priorityPrefix !== ''

    for (const skillMd of filtered) {
      if (!skillMd.startsWith(fullPrefix)) continue
      const rest = skillMd.slice(fullPrefix.length)
      const parts = rest.split('/')

      if (rest.toLowerCase() === 'skill.md' || (parts.length === 2 && parts[1].toLowerCase() === 'skill.md')) {
        if (!seen.has(skillMd)) {
          results.push(skillMd)
          seen.add(skillMd)
        }
        continue
      }

      if (isContainer && parts.length === 3 && parts[2].toLowerCase() === 'skill.md' && !SKIP_DIRS.has(parts[0]) && !SKIP_DIRS.has(parts[1])) {
        const parentSkillMd = `${fullPrefix}${parts[0]}/SKILL.md`.toLowerCase()
        if (!lowerSkillMdSet.has(parentSkillMd) && !seen.has(skillMd)) {
          results.push(skillMd)
          seen.add(skillMd)
        }
      }
    }
  }

  return results
}

function parseSkillMetadata(content: string): { name: string; description: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) throw new Error('SKILL.md is missing frontmatter.')

  const data = parse(match[1]) as { name?: unknown; description?: unknown }
  if (typeof data.name !== 'string' || typeof data.description !== 'string') {
    throw new Error('SKILL.md must include string name and description fields.')
  }

  return {
    name: sanitizeMetadata(data.name),
    description: sanitizeMetadata(data.description)
  }
}

function sanitizeMetadata(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

function sanitizeName(name: string): string {
  const safe = name
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  if (!safe) throw new Error(`Invalid skill name: ${name}`)
  return safe
}

function formatSource(source: SourceInfo): string {
  return `${source.owner}/${source.repo}`
}

function isInside(basePath: string, targetPath: string): boolean {
  const normalizedBase = resolve(basePath)
  const normalizedTarget = resolve(targetPath)
  return normalizedTarget === normalizedBase || normalizedTarget.startsWith(normalizedBase + sep)
}

async function copyDirectory(source: string, target: string): Promise<void> {
  await mkdir(target, { recursive: true })
  const { cp } = await import('fs/promises')
  await cp(source, target, { recursive: true })
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
