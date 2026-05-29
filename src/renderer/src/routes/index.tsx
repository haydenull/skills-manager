import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Button, Chip, Spinner } from '@heroui/react'
import { RiDeleteBinLine, RiFolderLine, RiInboxLine, RiRefreshLine, RiTerminalBoxLine } from '@remixicon/react'
import type { AgentId, InstalledSkill, OperationResult } from '../../../shared/skills-types'

export const Route = createFileRoute('/')({
  component: DashboardPage
})

const AGENT_OPTIONS: Array<{ id: AgentId; label: string }> = [
  { id: 'claude-code', label: 'Claude Code' },
  { id: 'codex', label: 'Codex' }
]

function DashboardPage(): React.JSX.Element {
  const [installedSkills, setInstalledSkills] = useState<InstalledSkill[]>([])
  const [logs, setLogs] = useState<string[]>([])
  const [busyLabel, setBusyLabel] = useState<string | null>(null)

  useEffect(() => {
    void refreshSkills()
  }, [])

  async function run(label: string, action: () => Promise<OperationResult | void>): Promise<void> {
    setBusyLabel(label)
    setLogs([`${label}...`])

    try {
      const result = await action()
      if (result) {
        setLogs(result.logs.length > 0 ? result.logs : [result.ok ? '完成。' : '失败。'])
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
  }

  async function addAgent(skill: InstalledSkill, agent: AgentId): Promise<void> {
    await run(`正在安装 ${skill.name}`, () =>
      window.api.skills.addAgents({
        names: [skill.name],
        agents: [agent]
      })
    )
  }

  async function removeAgent(skill: InstalledSkill, agent: AgentId): Promise<void> {
    await run(`正在移除 ${skill.name}`, () =>
      window.api.skills.remove({
        names: [skill.name],
        agents: [agent]
      })
    )
  }

  async function removeAll(skill: InstalledSkill): Promise<void> {
    await run(`正在完全删除 ${skill.name}`, () =>
      window.api.skills.remove({
        names: [skill.name],
        agents: []
      })
    )
  }

  const busy = busyLabel !== null

  return (
    <section className="grid flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/80">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-5 py-4">
          <div>
            <h2 className="text-base font-medium">已安装技能</h2>
            <p className="mt-1 text-xs text-zinc-500">此应用管理的技能，共 {installedSkills.length} 个</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {busy && (
              <div className="flex items-center gap-2 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200">
                <Spinner size="sm" />
                <span>{busyLabel}</span>
              </div>
            )}
            <Button size="sm" variant="secondary" onPress={() => void refreshSkills()} isDisabled={busy}>
              <span className="inline-flex items-center gap-1.5">
                <RiRefreshLine size={16} />
                刷新
              </span>
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-950/40 text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-3">名称</th>
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">来源</th>
                <th className="px-4 py-3">存储位置</th>
                <th className="px-4 py-3">更新时间</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {installedSkills.map((skill) => (
                <tr key={skill.name} className="border-b border-zinc-800/70 transition-colors last:border-none hover:bg-zinc-800/30">
                  <td className="px-4 py-3 font-medium text-zinc-100">{skill.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {AGENT_OPTIONS.map((agent) => (
                        <Chip key={agent.id} size="sm" variant={skill.agents.includes(agent.id) ? 'primary' : 'soft'}>
                          {agent.label}
                        </Chip>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{skill.source || '-'}</td>
                  <td className="max-w-[240px] truncate px-4 py-3 font-mono text-xs text-zinc-500">
                    <span className="inline-flex max-w-full items-center gap-1">
                      <RiFolderLine size={14} className="shrink-0" />
                      <span className="truncate">{skill.storagePath}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{skill.updatedAt ? new Date(skill.updatedAt).toLocaleString() : '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {AGENT_OPTIONS.map((agent) =>
                        skill.agents.includes(agent.id) ? (
                          <Button key={agent.id} size="sm" variant="secondary" onPress={() => void removeAgent(skill, agent.id)} isDisabled={busy}>
                            从 {agent.label} 移除
                          </Button>
                        ) : (
                          <Button key={agent.id} size="sm" variant="primary" onPress={() => void addAgent(skill, agent.id)} isDisabled={busy}>
                            安装到 {agent.label}
                          </Button>
                        )
                      )}
                      <Button size="sm" variant="danger-soft" onPress={() => void removeAll(skill)} isDisabled={busy}>
                        <span className="inline-flex items-center gap-1.5">
                          <RiDeleteBinLine size={16} />
                          完全删除
                        </span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {installedSkills.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                    <div className="flex flex-col items-center gap-3">
                      <RiInboxLine size={28} />
                      <span>还没有通过此应用安装的技能。</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
