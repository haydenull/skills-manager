import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Button, Chip, Spinner, Table, Tooltip } from '@heroui/react'
import {
  RiClaudeLine,
  RiDeleteBinLine,
  RiFolderOpenLine,
  RiGithubLine,
  RiGitlabLine,
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
  const [skillsWithUpdates, setSkillsWithUpdates] = useState<string[]>([])
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
    const statuses = await window.api.skills.checkUpdates(skills.map((skill) => skill.name))
    setSkillsWithUpdates(statuses.filter((status) => status.hasUpdate).map((status) => status.name))
    const errors = statuses.flatMap((status) => (status.error ? [status.error] : []))
    if (errors.length > 0) setLogs(errors)
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

  async function updateSkill(skill: InstalledSkill): Promise<void> {
    await run(`正在更新 ${skill.name}`, () => window.api.skills.update([skill.name]))
  }

  async function openStorageFolder(skill: InstalledSkill): Promise<void> {
    try {
      const result = await window.api.skills.openStorageFolder(skill.name)
      if (!result.ok) setLogs(result.logs)
    } catch (error) {
      setLogs([error instanceof Error ? error.message : String(error)])
    }
  }

  const busy = busyLabel !== null

  return (
    <section className="grid flex-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
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
            <Table.Content className="min-w-[720px] table-fixed">
              <Table.Header>
                <Table.Column className="w-40" isRowHeader>
                  名称
                </Table.Column>
                <Table.Column className="w-24">Agent</Table.Column>
                <Table.Column className="w-40">来源</Table.Column>
                <Table.Column className="w-40">更新时间</Table.Column>
                <Table.Column className="w-32">操作</Table.Column>
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
                    <Table.Cell className="font-medium text-foreground">
                      <div className="flex min-w-0 items-center gap-2">
                        <Tooltip>
                          <Tooltip.Trigger className="block min-w-0 truncate text-left">{skill.name}</Tooltip.Trigger>
                          <Tooltip.Content>{skill.name}</Tooltip.Content>
                        </Tooltip>
                        {skillsWithUpdates.includes(skill.name) && (
                          <Chip size="sm" color="accent" variant="soft">
                            可更新
                          </Chip>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex gap-2">
                        {AGENT_OPTIONS.map((agent) => {
                          const Icon = agent.icon
                          const isInstalled = skill.agents.includes(agent.id)
                          const label = isInstalled ? `从 ${agent.label} 移除 ${skill.name}` : `安装 ${skill.name} 到 ${agent.label}`

                          return (
                            <Tooltip key={agent.id}>
                              <Tooltip.Trigger className="inline-flex">
                                <button
                                  type="button"
                                  aria-label={label}
                                  className={`inline-flex size-8 shrink-0 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                    isInstalled
                                      ? 'border-accent/40 bg-accent-soft text-accent-soft-foreground'
                                      : 'border-border bg-surface text-muted hover:border-border-secondary hover:bg-surface-hover hover:text-foreground'
                                  }`}
                                  onClick={() => void (isInstalled ? removeAgent(skill, agent.id) : addAgent(skill, agent.id))}
                                  disabled={busy}
                                >
                                  <Icon size={18} />
                                </button>
                              </Tooltip.Trigger>
                              <Tooltip.Content>{label}</Tooltip.Content>
                            </Tooltip>
                          )
                        })}
                      </div>
                    </Table.Cell>
                    <Table.Cell className="text-muted">
                      {skill.source ? (
                        <div className="flex min-w-0 items-center gap-1.5">
                          {skill.provider === 'gitlab' ? (
                            <RiGitlabLine size={16} className="shrink-0" />
                          ) : (
                            <RiGithubLine size={16} className="shrink-0" />
                          )}
                          <Tooltip>
                            <Tooltip.Trigger className="block min-w-0 truncate text-left">{getRepositoryName(skill.source)}</Tooltip.Trigger>
                            <Tooltip.Content className="max-w-md break-all font-mono text-xs">{skill.source}</Tooltip.Content>
                          </Tooltip>
                        </div>
                      ) : (
                        '-'
                      )}
                    </Table.Cell>
                    <Table.Cell className="whitespace-nowrap text-xs text-muted">
                      {skill.updatedAt ? new Date(skill.updatedAt).toLocaleString() : '-'}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex gap-2">
                        {skillsWithUpdates.includes(skill.name) && (
                          <Tooltip>
                            <Tooltip.Trigger className="inline-flex">
                              <button
                                type="button"
                                aria-label={`更新 ${skill.name}`}
                                className="inline-flex size-8 items-center justify-center rounded-md border border-accent/50 bg-accent-soft text-accent-soft-foreground transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-50"
                                onClick={() => void updateSkill(skill)}
                                disabled={busy}
                              >
                                <RiRefreshLine size={16} />
                              </button>
                            </Tooltip.Trigger>
                            <Tooltip.Content>{`更新 ${skill.name}`}</Tooltip.Content>
                          </Tooltip>
                        )}
                        <Tooltip>
                          <Tooltip.Trigger className="inline-flex">
                            <button
                              type="button"
                              aria-label={`打开 ${skill.name} 文件夹`}
                              className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-surface text-muted transition-colors hover:border-border-secondary hover:bg-surface-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                              onClick={() => void openStorageFolder(skill)}
                              disabled={busy}
                            >
                              <RiFolderOpenLine size={16} />
                            </button>
                          </Tooltip.Trigger>
                          <Tooltip.Content>{`打开 ${skill.name} 文件夹`}</Tooltip.Content>
                        </Tooltip>
                        <Tooltip>
                          <Tooltip.Trigger className="inline-flex">
                            <button
                              type="button"
                              aria-label={`删除 ${skill.name}`}
                              className="inline-flex size-8 items-center justify-center rounded-md border border-danger/30 bg-danger-soft text-danger-soft-foreground transition-colors hover:border-danger/50 disabled:cursor-not-allowed disabled:opacity-50"
                              onClick={() => void removeAll(skill)}
                              disabled={busy}
                            >
                              <RiDeleteBinLine size={16} />
                            </button>
                          </Tooltip.Trigger>
                          <Tooltip.Content>{`删除 ${skill.name}`}</Tooltip.Content>
                        </Tooltip>
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

function getRepositoryName(source: string): string {
  return (
    source
      .replace(/\/$/, '')
      .replace(/\.git$/, '')
      .split(/[/:]/)
      .at(-1) || source
  )
}
