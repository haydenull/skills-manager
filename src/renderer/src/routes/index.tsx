import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Chip, Spinner, Table, Tooltip } from '@heroui/react'
import {
  RiClaudeLine,
  RiDeleteBinLine,
  RiFolderLine,
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
import { cn } from '../lib/cn'
import { skillsQueryKeys, skillsQueryOptions } from '../skills-queries'

export const Route = createFileRoute('/')({
  component: DashboardPage
})

const AGENT_OPTIONS = [
  { id: 'claude-code', label: 'Claude Code', icon: RiClaudeLine },
  { id: 'codex', label: 'Codex', icon: RiOpenaiLine }
] satisfies Array<{ id: AgentId; label: string; icon: typeof RiRobotLine }>

const REFRESH_SKILLS_LABEL = '正在刷新 Skill'

type OperationMutationVariables = {
  label: string
  action: () => Promise<OperationResult | void>
  invalidateUpdates: boolean
  showDefaultResult: boolean
}

function DashboardPage(): React.JSX.Element {
  const queryClient = useQueryClient()

  const { data: installedSkills = [], refetch: refetchInstalledSkills } = useQuery(skillsQueryOptions.installed())
  const installedSkillNames = installedSkills.map((skill) => skill.name)
  const { data: updateStatuses = [] } = useQuery({
    ...skillsQueryOptions.updates(installedSkillNames),
    enabled: installedSkillNames.length > 0
  })
  const skillsWithUpdates = updateStatuses.filter((status) => status.hasUpdate).map((status) => status.name)
  const updateErrors = updateStatuses.flatMap((status) => (status.error ? [status.error] : []))

  const operationMutation = useMutation({
    mutationFn: async ({ action, invalidateUpdates }: OperationMutationVariables) => {
      const result = await action()
      await queryClient.invalidateQueries({ queryKey: skillsQueryKeys.installed })
      if (invalidateUpdates) await queryClient.invalidateQueries({ queryKey: skillsQueryKeys.updatesRoot })
      return result
    }
  })

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const installedResult = await refetchInstalledSkills()
      const names = installedResult.data?.map((skill) => skill.name) ?? []
      const statuses = names.length > 0 ? await queryClient.fetchQuery(skillsQueryOptions.updates(names)) : []
      return statuses.flatMap((status) => (status.error ? [status.error] : []))
    }
  })

  function run(label: string, action: () => Promise<OperationResult | void>, invalidateUpdates = false, showDefaultResult = true): void {
    operationMutation.mutate({ label, action, invalidateUpdates, showDefaultResult })
  }

  function refreshSkillsWithFeedback(): void {
    refreshMutation.mutate()
  }

  function addAgent(skill: InstalledSkill, agent: AgentId): void {
    run(`正在安装 ${skill.name}`, () =>
      window.api.skills.addAgents({
        names: [skill.name],
        agents: [agent]
      })
    )
  }

  function removeAgent(skill: InstalledSkill, agent: AgentId): void {
    run(`正在移除 ${skill.name}`, () =>
      window.api.skills.remove({
        names: [skill.name],
        agents: [agent]
      })
    )
  }

  function removeAll(skill: InstalledSkill): void {
    run(`正在完全删除 ${skill.name}`, () =>
      window.api.skills.remove({
        names: [skill.name],
        agents: []
      })
    )
  }

  function updateSkill(skill: InstalledSkill): void {
    run(`正在更新 ${skill.name}`, () => window.api.skills.update([skill.name]), true)
  }

  function openStorageFolder(skill: InstalledSkill): void {
    run(`正在打开 ${skill.name} 文件夹`, () => window.api.skills.openStorageFolder(skill.name), false, false)
  }

  const busy = operationMutation.isPending || refreshMutation.isPending
  const busyLabel = operationMutation.isPending ? operationMutation.variables.label : refreshMutation.isPending ? REFRESH_SKILLS_LABEL : null
  const isRefreshing = refreshMutation.isPending
  const displayedLogs = (() => {
    const operationIsLatest = operationMutation.submittedAt > 0 && operationMutation.submittedAt >= refreshMutation.submittedAt
    const refreshIsLatest = refreshMutation.submittedAt > 0 && refreshMutation.submittedAt > operationMutation.submittedAt

    if (operationIsLatest) {
      if (operationMutation.isPending) {
        return [`${operationMutation.variables.label}...`]
      }
      if (operationMutation.isError) {
        return [operationMutation.error instanceof Error ? operationMutation.error.message : String(operationMutation.error)]
      }
      if (operationMutation.isSuccess && operationMutation.data) {
        if (operationMutation.data.logs.length > 0) return operationMutation.data.logs
        if (operationMutation.variables.showDefaultResult) return [operationMutation.data.ok ? '完成。' : '失败。']
      }
    }

    if (refreshIsLatest) {
      if (refreshMutation.isPending) return [`${REFRESH_SKILLS_LABEL}...`]
      if (refreshMutation.isError) return [refreshMutation.error instanceof Error ? refreshMutation.error.message : String(refreshMutation.error)]
      if (refreshMutation.isSuccess) return refreshMutation.data.length > 0 ? refreshMutation.data : ['刷新完成。']
    }

    return updateErrors
  })()

  return (
    <section className="grid flex-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <h2 className="text-base font-medium">已安装 Skill</h2>
            <p className="mt-1 text-xs text-muted">此应用管理的 Skill，共 {installedSkills.length} 个</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {busy && !isRefreshing && (
              <div className="flex items-center gap-2 rounded-md border border-accent/30 bg-accent-soft px-3 py-2 text-sm text-accent-soft-foreground">
                <Spinner size="sm" />
                <span>{busyLabel}</span>
              </div>
            )}
            <Button size="sm" variant="secondary" onPress={() => void refreshSkillsWithFeedback()} isDisabled={busy} isPending={isRefreshing}>
              {({ isPending }) => (
                <span className="inline-flex items-center gap-1.5">
                  {isPending ? <Spinner color="current" size="sm" /> : <RiRefreshLine size={16} />}
                  刷新
                </span>
              )}
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
                <Table.Column className="w-40">安装时间</Table.Column>
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
                                  className={cn(
                                    'inline-flex size-8 shrink-0 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                                    isInstalled
                                      ? 'border-accent/40 bg-accent-soft text-accent-soft-foreground'
                                      : 'border-border bg-surface text-muted hover:border-border-secondary hover:bg-surface-hover hover:text-foreground'
                                  )}
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
                          {skill.provider === 'local' ? (
                            <RiFolderLine size={16} className="shrink-0" />
                          ) : skill.provider === 'gitlab' ? (
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
                      {skill.installedAt ? new Date(skill.installedAt).toLocaleString() : '-'}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex gap-2">
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
          {displayedLogs.length > 0 ? displayedLogs.map((line, index) => <div key={`${line}-${index}`}>{line}</div>) : '暂无操作记录。'}
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
