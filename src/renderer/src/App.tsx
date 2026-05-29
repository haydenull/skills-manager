import { useEffect, useMemo, useState } from 'react'
import { Button, Checkbox, Chip, Input, Spinner } from '@heroui/react'
import type {
  AgentId,
  InstalledSkill,
  OperationResult,
  SkillPreview
} from '../../shared/skills-types'

const AGENT_OPTIONS: Array<{ id: AgentId; label: string }> = [
  { id: 'claude-code', label: 'Claude Code' },
  { id: 'codex', label: 'Codex' }
]

function App(): React.JSX.Element {
  const [installedSkills, setInstalledSkills] = useState<InstalledSkill[]>([])
  const [selectedInstalled, setSelectedInstalled] = useState<string[]>([])
  const [source, setSource] = useState('')
  const [previews, setPreviews] = useState<SkillPreview[]>([])
  const [selectedPreviews, setSelectedPreviews] = useState<string[]>([])
  const [selectedAgents, setSelectedAgents] = useState<AgentId[]>(['claude-code', 'codex'])
  const [logs, setLogs] = useState<string[]>([])
  const [busyLabel, setBusyLabel] = useState<string | null>(null)

  const selectedPreviewItems = useMemo(
    () => previews.filter((skill) => selectedPreviews.includes(skill.skillPath)),
    [previews, selectedPreviews]
  )

  useEffect(() => {
    void refreshSkills()
  }, [])

  async function run(label: string, action: () => Promise<OperationResult | void>): Promise<void> {
    setBusyLabel(label)
    setLogs([`${label}...`])

    try {
      const result = await action()
      if (result) {
        setLogs(result.logs.length > 0 ? result.logs : [result.ok ? 'Done.' : 'Failed.'])
      }
      await refreshSkills()
    } catch (error) {
      setLogs([error instanceof Error ? error.message : String(error)])
    } finally {
      setBusyLabel(null)
    }
  }

  async function refreshSkills(): Promise<void> {
    const skills = await window.api.skills.listGlobal()
    setInstalledSkills(skills)
    setSelectedInstalled((current) =>
      current.filter((name) => skills.some((skill) => skill.name === name))
    )
  }

  async function previewSource(): Promise<void> {
    await run('Previewing source', async () => {
      const skills = await window.api.skills.previewGitHubSource(source)
      setPreviews(skills)
      setSelectedPreviews(skills.map((skill) => skill.skillPath))
      return {
        ok: true,
        logs: skills.length > 0 ? [`Found ${skills.length} skills.`] : ['No skills found.']
      }
    })
  }

  async function installSkills(): Promise<void> {
    await run('Installing skills', () =>
      window.api.skills.install({
        source,
        skills: selectedPreviewItems,
        agents: selectedAgents
      })
    )
  }

  async function updateSkills(): Promise<void> {
    await run('Updating skills', () => window.api.skills.update(selectedInstalled))
  }

  async function removeSkills(): Promise<void> {
    await run('Removing skills', () =>
      window.api.skills.remove({
        names: selectedInstalled,
        agents: selectedAgents
      })
    )
  }

  function toggleInstalled(name: string): void {
    setSelectedInstalled((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name]
    )
  }

  function togglePreview(path: string): void {
    setSelectedPreviews((current) =>
      current.includes(path) ? current.filter((item) => item !== path) : [...current, path]
    )
  }

  function toggleAgent(agent: AgentId): void {
    setSelectedAgents((current) =>
      current.includes(agent) ? current.filter((item) => item !== agent) : [...current, agent]
    )
  }

  const busy = busyLabel !== null

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-6 py-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-5">
          <div>
            <h1 className="text-2xl font-semibold">Skills Manager</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Manage global skills for Claude Code and Codex.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {busy && <Spinner size="sm" />}
            <Button
              size="sm"
              variant="secondary"
              onPress={() => void refreshSkills()}
              isDisabled={busy}
            >
              Refresh
            </Button>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/70">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
              <div>
                <h2 className="text-base font-medium">Installed Skills</h2>
                <p className="text-xs text-zinc-500">
                  {installedSkills.length} installed by this app
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  onPress={() => void updateSkills()}
                  isDisabled={busy || selectedInstalled.length === 0}
                >
                  Update
                </Button>
                <Button
                  size="sm"
                  variant="danger-soft"
                  onPress={() => void removeSkills()}
                  isDisabled={busy || selectedInstalled.length === 0}
                >
                  Remove
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="w-12 px-4 py-3"></th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Agents</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Storage</th>
                    <th className="px-4 py-3">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {installedSkills.map((skill) => (
                    <tr key={skill.name} className="border-b border-zinc-800/70 last:border-none">
                      <td className="px-4 py-3">
                        <Checkbox
                          isSelected={selectedInstalled.includes(skill.name)}
                          onChange={() => toggleInstalled(skill.name)}
                          aria-label={`Select ${skill.name}`}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-100">{skill.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {skill.agents.map((agent) => (
                            <Chip key={agent} size="sm" variant="soft">
                              {agent === 'claude-code' ? 'Claude Code' : 'Codex'}
                            </Chip>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zinc-400">{skill.source || '-'}</td>
                      <td className="max-w-[260px] truncate px-4 py-3 font-mono text-xs text-zinc-500">
                        {skill.storagePath}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        {skill.updatedAt ? new Date(skill.updatedAt).toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))}
                  {installedSkills.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                        No skills installed by this app yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="flex flex-col gap-4">
            <section className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
              <h2 className="text-base font-medium">Install from GitHub</h2>
              <div className="mt-4 flex flex-col gap-3">
                <Input
                  aria-label="Repository"
                  placeholder="vercel-labs/agent-skills"
                  value={source}
                  onChange={(event) => setSource(event.target.value)}
                  disabled={busy}
                />
                <div className="flex flex-wrap gap-2">
                  {AGENT_OPTIONS.map((agent) => (
                    <Checkbox
                      key={agent.id}
                      isSelected={selectedAgents.includes(agent.id)}
                      onChange={() => toggleAgent(agent.id)}
                    >
                      {agent.label}
                    </Checkbox>
                  ))}
                </div>
                <Button
                  variant="primary"
                  onPress={() => void previewSource()}
                  isDisabled={busy || source.trim() === ''}
                >
                  Preview
                </Button>
              </div>
            </section>

            <section className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-medium">Available Skills</h2>
                <span className="text-xs text-zinc-500">
                  {selectedPreviewItems.length} selected
                </span>
              </div>
              <div className="mt-4 flex max-h-[360px] flex-col gap-3 overflow-auto pr-1">
                {previews.map((skill) => (
                  <label key={skill.skillPath} className="rounded-md border border-zinc-800 p-3">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        isSelected={selectedPreviews.includes(skill.skillPath)}
                        onChange={() => togglePreview(skill.skillPath)}
                        aria-label={`Select ${skill.name}`}
                      />
                      <div>
                        <div className="font-medium">{skill.name}</div>
                        <p className="mt-1 text-xs leading-5 text-zinc-400">{skill.description}</p>
                        <div className="mt-2 font-mono text-[11px] text-zinc-600">
                          {skill.skillPath}
                        </div>
                      </div>
                    </div>
                  </label>
                ))}
                {previews.length === 0 && (
                  <div className="py-8 text-center text-sm text-zinc-500">
                    Preview a repository first.
                  </div>
                )}
              </div>
              <Button
                className="mt-4 w-full"
                variant="primary"
                onPress={() => void installSkills()}
                isDisabled={
                  busy || selectedPreviewItems.length === 0 || selectedAgents.length === 0
                }
              >
                Install Selected
              </Button>
            </section>

            <section className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
              <h2 className="text-base font-medium">Logs</h2>
              <div className="mt-3 min-h-32 rounded-md bg-zinc-950 p-3 font-mono text-xs leading-5 text-zinc-400">
                {logs.length > 0
                  ? logs.map((line, index) => <div key={`${line}-${index}`}>{line}</div>)
                  : 'No operations yet.'}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  )
}

export default App
