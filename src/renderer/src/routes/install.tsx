import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { Button, Checkbox, Input, Spinner } from '@heroui/react'
import { RiDownloadLine, RiGithubLine, RiInboxLine, RiSearchLine, RiTerminalBoxLine } from '@remixicon/react'
import type { AgentId, OperationResult, SkillPreview } from '../../../shared/skills-types'

export const Route = createFileRoute('/install')({
  component: InstallPage
})

const AGENT_OPTIONS: Array<{ id: AgentId; label: string }> = [
  { id: 'claude-code', label: 'Claude Code' },
  { id: 'codex', label: 'Codex' }
]

function InstallPage(): React.JSX.Element {
  const [source, setSource] = useState('')
  const [previews, setPreviews] = useState<SkillPreview[]>([])
  const [selectedPreviews, setSelectedPreviews] = useState<string[]>([])
  const [selectedAgents, setSelectedAgents] = useState<AgentId[]>(['claude-code', 'codex'])
  const [logs, setLogs] = useState<string[]>([])
  const [busyLabel, setBusyLabel] = useState<string | null>(null)

  const selectedPreviewItems = useMemo(() => previews.filter((skill) => selectedPreviews.includes(skill.skillPath)), [previews, selectedPreviews])

  async function run(label: string, action: () => Promise<OperationResult | void>): Promise<void> {
    setBusyLabel(label)
    setLogs([`${label}...`])

    try {
      const result = await action()
      if (result) {
        setLogs(result.logs.length > 0 ? result.logs : [result.ok ? '完成。' : '失败。'])
      }
    } catch (error) {
      setLogs([error instanceof Error ? error.message : String(error)])
    } finally {
      setBusyLabel(null)
    }
  }

  async function previewSource(): Promise<void> {
    await run('正在预览来源', async () => {
      const skills = await window.api.skills.previewGitHubSource(source)
      setPreviews(skills)
      setSelectedPreviews(skills.map((skill) => skill.skillPath))
      return {
        ok: true,
        logs: skills.length > 0 ? [`找到 ${skills.length} 个技能。`] : ['没有找到技能。']
      }
    })
  }

  async function installSkills(): Promise<void> {
    await run('正在安装技能', () =>
      window.api.skills.install({
        source,
        skills: selectedPreviewItems,
        agents: selectedAgents
      })
    )
  }

  function togglePreview(path: string): void {
    setSelectedPreviews((current) => (current.includes(path) ? current.filter((item) => item !== path) : [...current, path]))
  }

  function toggleAgent(agent: AgentId): void {
    setSelectedAgents((current) => (current.includes(agent) ? current.filter((item) => item !== agent) : [...current, agent]))
  }

  const busy = busyLabel !== null

  return (
    <section className="grid flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex flex-col gap-5">
        <section className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <RiGithubLine size={18} className="text-cyan-300" />
              <h2 className="text-base font-medium">从 GitHub 安装</h2>
            </div>
            {busy && (
              <div className="flex items-center gap-2 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200">
                <Spinner size="sm" />
                <span>{busyLabel}</span>
              </div>
            )}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <Input
              aria-label="Repository"
              placeholder="vercel-labs/agent-skills"
              value={source}
              onChange={(event) => setSource(event.target.value)}
              disabled={busy}
            />
            <Button variant="primary" onPress={() => void previewSource()} isDisabled={busy || source.trim() === ''}>
              <span className="inline-flex items-center gap-1.5">
                <RiSearchLine size={16} />
                预览来源
              </span>
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            {AGENT_OPTIONS.map((agent) => (
              <Checkbox key={agent.id} isSelected={selectedAgents.includes(agent.id)} onChange={() => toggleAgent(agent.id)}>
                {agent.label}
              </Checkbox>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-medium">可安装技能</h2>
            <span className="text-xs text-zinc-500">已选择 {selectedPreviewItems.length} 个</span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {previews.map((skill) => (
              <label key={skill.skillPath} className="rounded-md border border-zinc-800 bg-zinc-950/30 p-3 transition-colors hover:border-zinc-700">
                <div className="flex items-start gap-3">
                  <Checkbox
                    isSelected={selectedPreviews.includes(skill.skillPath)}
                    onChange={() => togglePreview(skill.skillPath)}
                    aria-label={`Select ${skill.name}`}
                  />
                  <div>
                    <div className="font-medium">{skill.name}</div>
                    <p className="mt-1 text-xs leading-5 text-zinc-400">{skill.description}</p>
                    <div className="mt-2 font-mono text-[11px] text-zinc-600">{skill.skillPath}</div>
                  </div>
                </div>
              </label>
            ))}
            {previews.length === 0 && (
              <div className="col-span-full flex flex-col items-center gap-3 py-12 text-center text-sm text-zinc-500">
                <RiInboxLine size={28} />
                <span>先预览一个 GitHub 仓库。</span>
              </div>
            )}
          </div>
          <Button
            className="mt-4"
            variant="primary"
            onPress={() => void installSkills()}
            isDisabled={busy || selectedPreviewItems.length === 0 || selectedAgents.length === 0}
          >
            <span className="inline-flex items-center gap-1.5">
              <RiDownloadLine size={16} />
              安装已选择
            </span>
          </Button>
        </section>
      </div>

      <aside className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
        <div className="flex items-center gap-2">
          <RiTerminalBoxLine size={18} className="text-cyan-300" />
          <h2 className="text-base font-medium">操作日志</h2>
        </div>
        <div className="mt-3 min-h-32 rounded-md border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs leading-5 text-zinc-400">
          {logs.length > 0 ? logs.map((line, index) => <div key={`${line}-${index}`}>{line}</div>) : '暂无操作记录。'}
        </div>
      </aside>
    </section>
  )
}
