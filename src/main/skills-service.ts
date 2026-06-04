import { app, dialog, shell } from 'electron'
import { execFile } from 'child_process'
import { createHash } from 'crypto'
import { homedir, tmpdir } from 'os'
import { dirname, isAbsolute, join, resolve, sep } from 'path'
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'fs/promises'
import { promisify } from 'util'
import { parse } from 'yaml'
import type {
  AgentUpdateRequest,
  AgentId,
  InstallRequest,
  InstalledSkill,
  OperationResult,
  RemoveRequest,
  SettingsInfo,
  SettingsFolderTarget,
  SkillPreview,
  SkillUpdateStatus
} from '../shared/skills-types'

type SourceProvider = 'github' | 'gitlab' | 'local'

type SourceInfo = {
  provider: SourceProvider
  repositoryUrl?: string
  localPath?: string
  owner?: string
  repo?: string
  ref?: string
  subpath?: string
}

type TreeEntry = {
  path: string
  type: 'blob' | 'tree'
  sha: string
}

type SkillMdPath = {
  path: string
  skipInvalidMetadata?: boolean
}

type GitHubTree = {
  sha: string
  tree: TreeEntry[]
}

type RepositorySnapshot =
  | {
      source: SourceInfo
      tree: GitHubTree
    }
  | {
      source: SourceInfo
      rootPath: string
    }

type LockEntry = {
  name: string
  source: string
  provider?: SourceProvider
  repositoryUrl?: string
  localPath?: string
  owner?: string
  repo?: string
  ref?: string
  skillPath: string
  folderSha: string | null
  agents: AgentId[]
  storagePath: string
  installedAt: string
  debugPath?: string
}

type LockFile = {
  version: 1
  skills: Record<string, LockEntry>
}

const AGENTS: Record<AgentId, { displayName: string; dir: () => string }> = {
  'claude-code': {
    displayName: 'Claude Code',
    dir: () => join(getAgentConfigDir('claude-code'), 'skills')
  },
  codex: {
    displayName: 'Codex',
    dir: () => join(getAgentConfigDir('codex'), 'skills')
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
const GITHUB_BRANCH_CANDIDATES = ['HEAD', 'main', 'master']
const FETCH_TIMEOUT_MS = 10000
const CLONE_TIMEOUT_MS = 300000
const execFileAsync = promisify(execFile)

function getAgentConfigDir(agent: AgentId): string {
  if (process.env.SKILLS_MANAGER_LOCAL_DEBUG === '1') {
    return join(process.cwd(), '.debug', agent === 'claude-code' ? 'claude' : 'codex')
  }

  if (agent === 'claude-code') {
    return process.env.CLAUDE_CONFIG_DIR?.trim() || join(homedir(), '.claude')
  }

  return process.env.CODEX_HOME?.trim() || join(homedir(), '.codex')
}

export class SkillsService {
  async listGlobal(): Promise<InstalledSkill[]> {
    const lock = await this.readLock()

    const skills = await Promise.all(
      Object.values(lock.skills).map(async (skill) => {
        const skillMd = await readFile(join(skill.debugPath || skill.storagePath, 'SKILL.md'), 'utf-8')
        const metadata = parseSkillMetadata(skillMd)

        return {
          name: skill.name,
          description: metadata.description,
          storagePath: skill.storagePath,
          agents: skill.agents,
          source: skill.source,
          provider: skill.provider,
          installedAt: skill.installedAt,
          debugPath: skill.debugPath
        }
      })
    )

    return skills.sort((a, b) => a.name.localeCompare(b.name))
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

  async previewSource(source: string, fullDepth = false): Promise<SkillPreview[]> {
    const sourceInfo = await this.resolveSource(source)
    return this.withRepositorySnapshot(sourceInfo, async (snapshot) => {
      const previews = await this.parseSkillsFromSnapshot(snapshot, fullDepth)
      const lock = await this.readLock()
      return this.markInstallState(previews, snapshot.source, lock)
    })
  }

  async install(request: InstallRequest): Promise<OperationResult> {
    const logs: string[] = []

    try {
      const sourceInfo = await this.resolveSource(request.source)
      return await this.withRepositorySnapshot(sourceInfo, async (snapshot) => {
        const availableSkills = await this.parseSkillsFromSnapshot(snapshot, request.fullDepth)
        const selectedPaths = new Set(request.skills.map((skill) => skill.skillPath))
        const selectedSkills = availableSkills.filter((skill) => selectedPaths.has(skill.skillPath))

        if (selectedSkills.length === 0) {
          return { ok: false, logs: ['No selected skills were found in the source repository.'] }
        }

        const lock = await this.readLock()
        const invalidSkill = selectedSkills.map((skill) => this.getInstallState(skill, snapshot.source, lock)).find((state) => state.installState)

        if (selectedSkills.length !== selectedPaths.size) {
          return { ok: false, logs: ['Some selected skills were not found in the source repository.'] }
        }

        if (invalidSkill) {
          return { ok: false, logs: [invalidSkill.installMessage!] }
        }

        for (const skill of selectedSkills) {
          const skillName = sanitizeName(skill.name)
          const storagePath = this.getSkillStoragePath(skillName)
          logs.push(`Installing ${skill.name} to ${storagePath}`)

          await this.writeSkillFolderFromSnapshot(snapshot, skill, storagePath)

          for (const agent of request.agents) {
            const linkedPath = join(AGENTS[agent].dir(), skillName)
            await this.linkOrCopy(storagePath, linkedPath)
            logs.push(`Linked ${skill.name} for ${AGENTS[agent].displayName}`)
          }

          const now = new Date().toISOString()
          lock.skills[skillName] = {
            name: skill.name,
            source: formatSource(snapshot.source),
            provider: snapshot.source.provider,
            repositoryUrl: snapshot.source.repositoryUrl,
            localPath: snapshot.source.localPath,
            owner: snapshot.source.owner,
            repo: snapshot.source.repo,
            ref: snapshot.source.provider === 'github' ? snapshot.source.ref : undefined,
            skillPath: skill.skillPath,
            folderSha: skill.folderSha,
            agents: request.agents,
            storagePath,
            installedAt: now
          }
        }

        await this.writeLock(lock)
        return { ok: true, logs }
      })
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

      const sourcePath = entry.debugPath || entry.storagePath
      for (const agent of request.agents) {
        await this.linkOrCopy(sourcePath, join(AGENTS[agent].dir(), skillName))
        logs.push(`Linked ${entry.name} for ${AGENTS[agent].displayName}.`)
      }

      entry.agents = Array.from(new Set([...entry.agents, ...request.agents]))
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

      const sourceInfo = getLockEntrySource(entry)
      await this.withRepositorySnapshot(sourceInfo, async (snapshot) => {
        const latestFolderSha = await this.getSkillFolderShaFromSnapshot(snapshot, entry.skillPath)

        if (latestFolderSha && latestFolderSha === entry.folderSha) {
          logs.push(`${entry.name} is already up to date.`)
          return
        }

        const previews = await this.parseSkillsFromSnapshot(snapshot, true)
        const preview = previews.find((skill) => skill.skillPath === entry.skillPath)
        if (!preview) {
          logs.push(`Skipped ${entry.name}: upstream skill path no longer exists.`)
          return
        }

        await this.writeSkillFolderFromSnapshot(snapshot, preview, entry.storagePath)
        if (entry.debugPath) {
          logs.push(`Kept ${entry.name} in debug mode.`)
        } else {
          for (const agent of entry.agents) {
            await this.linkOrCopy(entry.storagePath, join(AGENTS[agent].dir(), sanitizeName(entry.name)))
          }
        }

        if (snapshot.source.provider === 'github') entry.ref = snapshot.source.ref!
        entry.folderSha = preview.folderSha
        entry.installedAt = new Date().toISOString()
        updated += 1
        logs.push(`Updated ${entry.name}.`)
      })
    }

    await this.writeLock(lock)
    return { ok: true, logs: logs.length > 0 ? logs : [`Updated ${updated} skills.`] }
  }

  async checkUpdates(names: string[]): Promise<SkillUpdateStatus[]> {
    const lock = await this.readLock()
    const statuses: SkillUpdateStatus[] = []

    for (const name of names) {
      const entry = lock.skills[sanitizeName(name)]
      if (!entry) continue

      try {
        const sourceInfo = getLockEntrySource(entry)
        await this.withRepositorySnapshot(sourceInfo, async (snapshot) => {
          const latestFolderSha = await this.getSkillFolderShaFromSnapshot(snapshot, entry.skillPath)
          statuses.push({
            name: entry.name,
            hasUpdate: !latestFolderSha || latestFolderSha !== entry.folderSha
          })
        })
      } catch (error) {
        statuses.push({
          name: entry.name,
          hasUpdate: false,
          error: `Failed to check updates for ${entry.name}: ${getErrorMessage(error)}`
        })
      }
    }

    return statuses
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

  async startDebug(name: string): Promise<OperationResult> {
    const lock = await this.readLock()
    const skillName = sanitizeName(name)
    const entry = lock.skills[skillName]
    if (!entry) return { ok: false, logs: [`Unable to debug ${name}: not installed by this app.`] }

    const result = await dialog.showOpenDialog({
      title: `选择 ${entry.name} 的调试 Skill 目录`,
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return { ok: true, logs: ['未选择调试目录。'] }

    const debugPath = result.filePaths[0]
    try {
      await validateDebugSkillPath(entry, debugPath)
    } catch (error) {
      return { ok: false, logs: [getErrorMessage(error)] }
    }

    entry.debugPath = debugPath
    for (const agent of entry.agents) {
      await this.linkOrCopy(debugPath, join(AGENTS[agent].dir(), skillName))
    }
    await this.writeLock(lock)
    return { ok: true, logs: [`${entry.name} 已切换到调试目录：${debugPath}`] }
  }

  async stopDebug(name: string): Promise<OperationResult> {
    const lock = await this.readLock()
    const skillName = sanitizeName(name)
    const entry = lock.skills[skillName]
    if (!entry) return { ok: false, logs: [`Unable to stop debug for ${name}: not installed by this app.`] }

    for (const agent of entry.agents) {
      await this.linkOrCopy(entry.storagePath, join(AGENTS[agent].dir(), skillName))
    }
    delete entry.debugPath
    await this.writeLock(lock)
    return { ok: true, logs: [`${entry.name} 已恢复正式版本。`] }
  }

  async openStorageFolder(name: string): Promise<OperationResult> {
    const entry = (await this.readLock()).skills[sanitizeName(name)]
    if (!entry) return { ok: false, logs: [`Unable to open ${name}: not installed by this app.`] }

    const error = await shell.openPath(entry.debugPath || entry.storagePath)
    return error ? { ok: false, logs: [`Unable to open ${name}: ${error}`] } : { ok: true, logs: [] }
  }

  async openSettingsFolder(target: SettingsFolderTarget, agentId?: AgentId): Promise<OperationResult> {
    const folderPath = target === 'app-data' ? this.getUserDataPath() : agentId ? AGENTS[agentId]?.dir() : undefined
    if (!folderPath) return { ok: false, logs: ['Unable to resolve settings folder.'] }

    await mkdir(folderPath, { recursive: true })
    const error = await shell.openPath(folderPath)
    return error ? { ok: false, logs: [`Unable to open ${folderPath}: ${error}`] } : { ok: true, logs: [] }
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

  private markInstallState(skills: SkillPreview[], source: SourceInfo, lock: LockFile): SkillPreview[] {
    return skills.map((skill) => ({
      ...skill,
      ...this.getInstallState(skill, source, lock)
    }))
  }

  private getInstallState(skill: SkillPreview, source: SourceInfo, lock: LockFile): Pick<SkillPreview, 'installState' | 'installMessage'> {
    const entry = lock.skills[sanitizeName(skill.name)]
    if (!entry) return {}

    if (isSameSource(source, getLockEntrySource(entry))) {
      return {
        installState: 'installed',
        installMessage: `${skill.name} 已安装。`
      }
    }

    return {
      installState: 'conflict',
      installMessage: `${skill.name} 与已安装 Skill 同名，已安装来源：${entry.source}。`
    }
  }

  private async resolveSource(input: string): Promise<SourceInfo> {
    const trimmed = input.trim()
    const localPath = resolveLocalPath(trimmed)
    if (localPath) {
      const stats = await stat(localPath)
      if (!stats.isDirectory()) throw new Error('Local skill source must be a directory.')
      return { provider: 'local', localPath }
    }

    const githubUrlMatch = trimmed.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/]+)(?:\/(.+))?)?\/?$/)
    const shorthandMatch = trimmed.match(/^([^/]+)\/([^/]+)$/)

    if (githubUrlMatch || shorthandMatch) {
      const match = githubUrlMatch || shorthandMatch!
      const owner = match[1]
      const repo = match[2].replace(/\.git$/, '')
      return {
        provider: 'github',
        repositoryUrl: `https://github.com/${owner}/${repo}.git`,
        owner,
        repo,
        ref: githubUrlMatch?.[3],
        subpath: githubUrlMatch?.[4]
      }
    }

    return resolveGitLabSource(trimmed)
  }

  private async fetchGitHubTree(source: SourceInfo): Promise<GitHubTree | null> {
    const branches = source.ref ? [source.ref] : GITHUB_BRANCH_CANDIDATES

    for (const branch of branches) {
      const tree = await this.fetchGitHubTreeBranch(source, branch)
      if (tree) {
        source.ref = branch
        return tree
      }
    }

    return null
  }

  private async withRepositorySnapshot<T>(source: SourceInfo, callback: (snapshot: RepositorySnapshot) => Promise<T>): Promise<T> {
    const snapshot = await this.fetchRepositorySnapshot(source)
    try {
      return await callback(snapshot)
    } finally {
      if ('rootPath' in snapshot && source.provider !== 'local') await cleanupTempDir(snapshot.rootPath)
    }
  }

  private async fetchRepositorySnapshot(source: SourceInfo): Promise<RepositorySnapshot> {
    if (source.provider === 'local') return { source, rootPath: source.localPath! }

    if (source.provider === 'github') {
      const tree = await this.fetchGitHubTree(source)
      if (tree) return { source, tree }
    }

    const rootPath = await cloneRepository(source)
    if (source.provider === 'github' && !source.ref) source.ref = 'HEAD'
    return { source, rootPath }
  }

  private async fetchGitHubTreeBranch(source: SourceInfo, branch: string): Promise<GitHubTree | null> {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${source.owner!}/${source.repo!}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
        {
          headers: getGitHubHeaders(),
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
        }
      )

      if (!response.ok) return null
      return (await response.json()) as GitHubTree
    } catch {
      return null
    }
  }

  private async parseSkillsFromSnapshot(snapshot: RepositorySnapshot, fullDepth = false): Promise<SkillPreview[]> {
    if ('tree' in snapshot) return this.parseSkillsFromTree(snapshot.source, snapshot.tree, fullDepth)
    return this.parseSkillsFromLocal(snapshot.source, snapshot.rootPath, fullDepth)
  }

  private async parseSkillsFromTree(source: SourceInfo, tree: GitHubTree, fullDepth: boolean): Promise<SkillPreview[]> {
    const paths = findSkillMdPaths(tree.tree, source.subpath, fullDepth)
    const previews: SkillPreview[] = []

    for (const { path: skillPath, skipInvalidMetadata } of paths) {
      const entry = tree.tree.find((item) => item.path === skillPath)
      if (!entry) continue
      const content = await this.fetchRawFile(source, skillPath)
      const metadata = parseSkillMetadata(content.toString('utf-8'), skipInvalidMetadata === true)
      if (!metadata) continue
      previews.push({
        name: metadata.name,
        description: metadata.description,
        skillPath,
        folderSha: this.getSkillFolderSha(tree, skillPath)
      })
    }

    return previews
  }

  private async parseSkillsFromLocal(source: SourceInfo, rootPath: string, fullDepth: boolean): Promise<SkillPreview[]> {
    const tree = await buildLocalTree(rootPath)
    const paths = findSkillMdPaths(tree.tree, source.subpath, fullDepth)
    const previews: SkillPreview[] = []

    for (const { path: skillPath, skipInvalidMetadata } of paths) {
      const skillMdPath = join(rootPath, skillPath)
      if (!isInside(rootPath, skillMdPath)) throw new Error(`Unsafe file path from repository: ${skillPath}`)

      const content = await readFile(skillMdPath, 'utf-8')
      const metadata = parseSkillMetadata(content, skipInvalidMetadata === true)
      if (!metadata) continue
      previews.push({
        name: metadata.name,
        description: metadata.description,
        skillPath,
        folderSha: await computeFolderHash(join(rootPath, dirname(skillPath)))
      })
    }

    return previews
  }

  private async writeSkillFolderFromSnapshot(snapshot: RepositorySnapshot, skill: SkillPreview, storagePath: string): Promise<void> {
    if ('tree' in snapshot) {
      await this.writeSkillFolderFromTree(snapshot.source, snapshot.tree, skill, storagePath)
      return
    }

    await this.writeSkillFolderFromLocal(snapshot.rootPath, skill, storagePath)
  }

  private async writeSkillFolderFromTree(source: SourceInfo, tree: GitHubTree, skill: SkillPreview, storagePath: string): Promise<void> {
    const skillDir = dirname(skill.skillPath)
    const prefix = skillDir === '.' ? '' : `${skillDir}/`
    const files = tree.tree.filter((entry) => entry.type === 'blob' && (prefix ? entry.path.startsWith(prefix) : true))

    await rm(storagePath, { recursive: true, force: true })
    await mkdir(storagePath, { recursive: true })

    for (const file of files) {
      const relativePath = prefix ? file.path.slice(prefix.length) : file.path
      const targetPath = join(storagePath, relativePath)
      if (!isInside(storagePath, targetPath)) throw new Error(`Unsafe file path from repository: ${file.path}`)

      const content = await this.fetchRawFile(source, file.path)
      await mkdir(dirname(targetPath), { recursive: true })
      await writeFile(targetPath, content)
    }

    const skillMd = await readFile(join(storagePath, 'SKILL.md'), 'utf-8')
    const metadata = parseSkillMetadata(skillMd)
    skill.name = metadata.name
    skill.description = metadata.description
  }

  private async writeSkillFolderFromLocal(rootPath: string, skill: SkillPreview, storagePath: string): Promise<void> {
    const skillDir = dirname(skill.skillPath)
    const sourcePath = skillDir === '.' ? rootPath : join(rootPath, skillDir)
    if (!isInside(rootPath, sourcePath)) throw new Error(`Unsafe skill path from repository: ${skill.skillPath}`)
    if (isInside(sourcePath, storagePath) || isInside(storagePath, sourcePath)) {
      throw new Error('Local skill source cannot overlap the app storage directory.')
    }

    await rm(storagePath, { recursive: true, force: true })
    await copySkillDirectory(sourcePath, storagePath)

    const skillMd = await readFile(join(storagePath, 'SKILL.md'), 'utf-8')
    const metadata = parseSkillMetadata(skillMd)
    skill.name = metadata.name
    skill.description = metadata.description
    skill.folderSha = await computeFolderHash(storagePath)
  }

  private async fetchRawFile(source: SourceInfo, path: string): Promise<Buffer> {
    const response = await fetch(
      `https://raw.githubusercontent.com/${source.owner!}/${source.repo!}/${encodeURIComponent(source.ref!)}/${path
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

  private async getSkillFolderShaFromSnapshot(snapshot: RepositorySnapshot, skillPath: string): Promise<string | null> {
    if ('tree' in snapshot) return this.getSkillFolderSha(snapshot.tree, skillPath)

    const skillDir = dirname(skillPath)
    const sourcePath = skillDir === '.' ? snapshot.rootPath : join(snapshot.rootPath, skillDir)
    if (!isInside(snapshot.rootPath, sourcePath)) throw new Error(`Unsafe skill path from repository: ${skillPath}`)
    return computeFolderHash(sourcePath)
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

function findSkillMdPaths(tree: TreeEntry[], subpath?: string, fullDepth = false): SkillMdPath[] {
  const allSkillMds = tree.filter((entry) => entry.type === 'blob' && entry.path.toLowerCase().endsWith('skill.md')).map((entry) => entry.path)
  const prefix = subpath ? (subpath.endsWith('/') ? subpath : `${subpath}/`) : ''
  const filtered = prefix ? allSkillMds.filter((path) => path.startsWith(prefix)) : allSkillMds
  const results: SkillMdPath[] = []
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
          results.push({ path: skillMd })
          seen.add(skillMd)
        }
        continue
      }

      if (isContainer && parts.length === 3 && parts[2].toLowerCase() === 'skill.md' && !SKIP_DIRS.has(parts[0]) && !SKIP_DIRS.has(parts[1])) {
        const parentSkillMd = `${fullPrefix}${parts[0]}/SKILL.md`.toLowerCase()
        if (!lowerSkillMdSet.has(parentSkillMd) && !seen.has(skillMd)) {
          results.push({ path: skillMd })
          seen.add(skillMd)
        }
      }
    }
  }

  if (results.length === 0 || fullDepth) {
    for (const skillMd of filtered) {
      if (seen.has(skillMd)) continue

      const relativePath = skillMd.slice(prefix.length)
      const parts = relativePath.split('/')
      const directories = parts.slice(0, -1)
      if (parts.at(-1)?.toLowerCase() !== 'skill.md' || directories.length > 5 || directories.some((directory) => SKIP_DIRS.has(directory))) continue

      results.push({ path: skillMd, skipInvalidMetadata: true })
      seen.add(skillMd)
    }
  }

  return results
}

function parseSkillMetadata(content: string): { name: string; description: string }
function parseSkillMetadata(content: string, skipInvalid: boolean): { name: string; description: string } | null
function parseSkillMetadata(content: string, skipInvalid = false): { name: string; description: string } | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) {
    if (skipInvalid) return null
    throw new Error('SKILL.md is missing frontmatter.')
  }

  let data: { name?: unknown; description?: unknown }
  try {
    data = parse(match[1]) as { name?: unknown; description?: unknown }
  } catch (error) {
    if (skipInvalid) return null
    throw error
  }
  if (typeof data.name !== 'string' || typeof data.description !== 'string') {
    if (skipInvalid) return null
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

function resolveLocalPath(input: string): string | null {
  if (input === '~') return homedir()
  if (/^~[\\/]/.test(input)) return resolve(homedir(), input.slice(2))
  return isAbsolute(input) ? resolve(input) : null
}

function formatSource(source: SourceInfo): string {
  if (source.provider === 'github') return `${source.owner}/${source.repo}`
  return source.provider === 'local' ? source.localPath! : source.repositoryUrl!
}

function isSameSource(a: SourceInfo, b: SourceInfo): boolean {
  if (a.provider !== b.provider) return false

  if (a.provider === 'github') {
    return a.owner?.toLowerCase() === b.owner?.toLowerCase() && a.repo?.toLowerCase() === b.repo?.toLowerCase()
  }

  if (a.provider === 'local') {
    return resolve(a.localPath!) === resolve(b.localPath!)
  }

  return a.repositoryUrl === b.repositoryUrl
}

function resolveGitLabSource(input: string): SourceInfo {
  const match = input.match(/^git@([^:]+):(.+?)\/?$/)
  if (!match || match[1] === 'github.com') {
    throw new Error('Use owner/repo for GitHub or an SSH clone URL for GitLab, such as git@gitlab.example.com:group/repo.git.')
  }

  const host = match[1]
  const repositoryPath = match[2].replace(/\.git$/, '')

  if (repositoryPath.split('/').length < 2) {
    throw new Error('GitLab SSH URL must include a group and repository name.')
  }

  const repositoryUrl = `git@${host}:${repositoryPath}.git`
  return { provider: 'gitlab', repositoryUrl }
}

function getLockEntrySource(entry: LockEntry): SourceInfo {
  if (entry.provider === 'local') {
    if (!entry.localPath) throw new Error(`Invalid local source for ${entry.name}.`)
    return { provider: 'local', localPath: entry.localPath }
  }

  if (entry.provider === 'gitlab') {
    if (!entry.repositoryUrl) throw new Error(`Invalid GitLab source for ${entry.name}.`)
    if (!entry.repositoryUrl.startsWith('git@')) {
      throw new Error(`GitLab source for ${entry.name} uses HTTPS. Reinstall it with an SSH clone URL.`)
    }
    return { provider: 'gitlab', repositoryUrl: entry.repositoryUrl }
  }

  if (!entry.owner || !entry.repo) throw new Error(`Invalid GitHub source for ${entry.name}.`)
  return {
    provider: 'github',
    repositoryUrl: entry.repositoryUrl || `https://github.com/${entry.owner}/${entry.repo}.git`,
    owner: entry.owner,
    repo: entry.repo,
    ref: entry.ref
  }
}

async function validateDebugSkillPath(entry: LockEntry, debugPath: string): Promise<void> {
  const stats = await stat(debugPath)
  if (!stats.isDirectory()) throw new Error('调试路径必须是目录。')

  const skillMd = await readFile(join(debugPath, 'SKILL.md'), 'utf-8')
  const metadata = parseSkillMetadata(skillMd)
  if (sanitizeName(metadata.name) !== sanitizeName(entry.name)) {
    throw new Error(`调试目录中的 Skill 名称必须是 ${entry.name}。`)
  }
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

async function cloneRepository(source: SourceInfo): Promise<string> {
  const tempPath = await mkdtemp(join(tmpdir(), 'skills-manager-'))
  const args = ['clone', '--depth', '1']
  if (source.ref && source.ref !== 'HEAD') args.push('--branch', source.ref)
  args.push(source.repositoryUrl!, tempPath)

  try {
    await execFileAsync('git', args, {
      timeout: CLONE_TIMEOUT_MS,
      env: getGitEnvironment()
    })
    return tempPath
  } catch (error) {
    await cleanupTempDir(tempPath)
    throw new Error(`Failed to clone repository: ${getErrorMessage(error)}`)
  }
}

function getGitEnvironment(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
    GIT_LFS_SKIP_SMUDGE: '1',
    GIT_SSH_COMMAND: 'ssh -o BatchMode=yes -o StrictHostKeyChecking=yes'
  }
}

async function cleanupTempDir(path: string): Promise<void> {
  const normalizedPath = resolve(path)
  const normalizedTmp = resolve(tmpdir())
  if (normalizedPath !== normalizedTmp && normalizedPath.startsWith(normalizedTmp + sep)) {
    await rm(path, { recursive: true, force: true })
  }
}

async function buildLocalTree(rootPath: string): Promise<GitHubTree> {
  const entries: TreeEntry[] = []

  async function walk(currentPath: string, relativePath: string): Promise<void> {
    const items = await readdir(currentPath, { withFileTypes: true })

    for (const item of items) {
      if (item.name === '.git') continue

      const absolutePath = join(currentPath, item.name)
      const entryPath = relativePath ? `${relativePath}/${item.name}` : item.name

      if (item.isDirectory()) {
        entries.push({ path: entryPath, type: 'tree', sha: '' })
        await walk(absolutePath, entryPath)
      } else if (item.isFile()) {
        entries.push({ path: entryPath, type: 'blob', sha: '' })
      }
    }
  }

  await walk(rootPath, '')
  return { sha: await computeFolderHash(rootPath), tree: entries }
}

async function copySkillDirectory(sourcePath: string, targetPath: string): Promise<void> {
  await mkdir(targetPath, { recursive: true })
  const items = await readdir(sourcePath, { withFileTypes: true })

  for (const item of items) {
    if (item.name === '.git') continue

    const sourceItem = join(sourcePath, item.name)
    const targetItem = join(targetPath, item.name)

    if (item.isDirectory()) {
      await copySkillDirectory(sourceItem, targetItem)
    } else if (item.isFile()) {
      await mkdir(dirname(targetItem), { recursive: true })
      await writeFile(targetItem, await readFile(sourceItem))
    }
  }
}

async function computeFolderHash(folderPath: string): Promise<string> {
  const hash = createHash('sha256')

  async function walk(currentPath: string, relativePath: string): Promise<void> {
    const items = (await readdir(currentPath, { withFileTypes: true }))
      .filter((item) => item.name !== '.git')
      .sort((a, b) => a.name.localeCompare(b.name))

    for (const item of items) {
      const sourceItem = join(currentPath, item.name)
      const entryPath = relativePath ? `${relativePath}/${item.name}` : item.name
      const stats = await lstat(sourceItem)

      if (stats.isDirectory()) {
        await walk(sourceItem, entryPath)
      } else if (stats.isFile()) {
        hash.update(entryPath)
        hash.update('\0')
        hash.update(await readFile(sourceItem))
        hash.update('\0')
      }
    }
  }

  await walk(folderPath, '')
  return `sha256:${hash.digest('hex')}`
}

function getGitHubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'skills-manager'
  }
  const token = process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim()
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
