import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Button, Spinner, Table, Tooltip } from '@heroui/react'
import {
  RiClaudeLine,
  RiDeleteBinLine,
  RiFolderLine,
  RiInboxLine,
  RiOpenaiLine,
  RiRefreshLine,
  RiRobotLine,
  RiTerminalBoxLine
} from '@remixicon/react'
import type { AgentId, InstalledSkill, OperationResult } from '../../../shared/skills-types'

export const Route = createFileRoute('/')({
  component: DashboardPage
})

const AGENT_OPTIONS = [
  { id: 'claude-code', label: 'Claude Code', icon: RiClaudeLine },
  { id: 'codex', label: 'Codex', icon: RiOpenaiLine }
] satisfies Array<{ id: AgentId; label: string; icon: typeof RiRobotLine }>

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
      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <h2 className="text-base font-medium">已安装 Skill</h2>
            <p className="mt-1 text-xs text-muted">此应用管理的 Skill，共 {installedSkills.length} 个</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {busy && (
              <div className="flex items-center gap-2 rounded-md border border-accent/30 bg-accent-soft px-3 py-2 text-sm text-accent-soft-foreground">
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

        <Table variant="secondary" className="px-4">
          <Table.ScrollContainer>
            <Table.Content className="min-w-[900px]">
              <Table.Header>
                <Table.Column isRowHeader>名称</Table.Column>
                <Table.Column>Agent</Table.Column>
                <Table.Column>来源</Table.Column>
                <Table.Column>存储位置</Table.Column>
                <Table.Column>更新时间</Table.Column>
                <Table.Column>操作</Table.Column>
              </Table.Header>
              <Table.Body
                renderEmptyState={() => (
                  <div className="flex flex-col items-center gap-3 px-4 py-12 text-center text-muted">
                    <RiInboxLine size={28} />
                    <span>还没有通过此应用安装的 Skill。</span>
                  </div>
                )}
              >
                {installedSkills.map((skill) => (
                  <Table.Row key={skill.name} id={skill.name}>
                    <Table.Cell className="font-medium text-foreground">{skill.name}</Table.Cell>
                    <Table.Cell>
                      <div className="flex flex-wrap gap-2">
                        {AGENT_OPTIONS.map((agent) => {
                          const Icon = agent.icon
                          const isInstalled = skill.agents.includes(agent.id)
                          const label = isInstalled ? `从 ${agent.label} 移除 ${skill.name}` : `安装 ${skill.name} 到 ${agent.label}`

                          return (
                            <button
                              key={agent.id}
                              type="button"
                              aria-label={label}
                              title={label}
                              className={`inline-flex size-8 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                isInstalled
                                  ? 'border-accent/40 bg-accent-soft text-accent-soft-foreground'
                                  : 'border-border bg-surface text-muted hover:border-border-secondary hover:bg-surface-hover hover:text-foreground'
                              }`}
                              onClick={() => void (isInstalled ? removeAgent(skill, agent.id) : addAgent(skill, agent.id))}
                              disabled={busy}
                            >
                              <Icon size={18} />
                            </button>
                          )
                        })}
                      </div>
                    </Table.Cell>
                    <Table.Cell className="text-muted">{skill.source || '-'}</Table.Cell>
                    <Table.Cell className="max-w-[240px] truncate font-mono text-xs text-muted">
                      <Tooltip>
                        <Tooltip.Trigger className="inline-flex max-w-full min-w-0 items-center gap-1">
                          <RiFolderLine size={14} className="shrink-0" />
                          <span className="min-w-0 truncate">{skill.storagePath}</span>
                        </Tooltip.Trigger>
                        <Tooltip.Content className="max-w-md break-all font-mono text-xs">{skill.storagePath}</Tooltip.Content>
                      </Tooltip>
                    </Table.Cell>
                    <Table.Cell className="text-muted">{skill.updatedAt ? new Date(skill.updatedAt).toLocaleString() : '-'}</Table.Cell>
                    <Table.Cell>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="danger-soft" onPress={() => void removeAll(skill)} isDisabled={busy}>
                          <span className="inline-flex items-center gap-1.5">
                            <RiDeleteBinLine size={16} />
                            删除
                          </span>
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </div>

      <aside className="rounded-lg border border-border bg-surface p-4 shadow-surface">
        <div className="flex items-center gap-2">
          <RiTerminalBoxLine size={18} className="text-accent" />
          <h2 className="text-base font-medium">操作日志</h2>
        </div>
        <div className="mt-3 min-h-32 rounded-md border border-border bg-surface-secondary p-3 font-mono text-xs leading-5 text-muted">
          {logs.length > 0 ? logs.map((line, index) => <div key={`${line}-${index}`}>{line}</div>) : '暂无操作记录。'}
        </div>
      </aside>
    </section>
  )
}
