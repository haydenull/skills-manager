import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Chip, Spinner, Switch, Tooltip } from '@heroui/react'
import { toast } from '@heroui/react/toast'
import { useState } from 'react'
import {
  RiBookOpenLine,
  RiClaudeLine,
  RiDeleteBinLine,
  RiExternalLinkLine,
  RiFileCopyLine,
  RiFolderLine,
  RiFolderOpenLine,
  RiGithubLine,
  RiGitlabLine,
  RiInboxLine,
  RiLoader4Line,
  RiOpenaiLine,
  RiPlayLine,
  RiRefreshLine,
  RiRobotLine,
  RiSearchLine,
  RiStopLine
} from '@remixicon/react'
import type { AgentId, InstalledSkill, OperationResult } from '../../../shared/skills-types'
import { type SourceFilter, useHomeSidebar } from '../home-sidebar-context'
import { cn } from '../lib/cn'
import { executeIpcOperation } from '../lib/execute-ipc-operation'
import { skillsQueryKeys, skillsQueryOptions } from '../skills-queries'

export const Route = createFileRoute('/')({
  component: DashboardPage
})

const AGENT_OPTIONS = [
  { id: 'claude-code', label: 'Claude Code', shortLabel: 'Claude', icon: RiClaudeLine },
  { id: 'codex', label: 'Codex', shortLabel: 'Codex', icon: RiOpenaiLine }
] satisfies Array<{ id: AgentId; label: string; shortLabel: string; icon: typeof RiRobotLine }>

type SkillStatusFilter = 'all' | 'updates' | 'debug'

type AgentMutationVariables = {
  skillName: string
  agent: AgentId
}

const STATUS_FILTERS = [
  { id: 'all', label: '全部' },
  { id: 'updates', label: '可更新' },
  { id: 'debug', label: '调试中' }
] satisfies Array<{ id: SkillStatusFilter; label: string }>

function showOperationSuccess(result: OperationResult): void {
  toast.success('操作完成', {
    description: result.logs.slice(0, 3).join('\n') || undefined
  })
}

function DashboardPage(): React.JSX.Element {
  const queryClient = useQueryClient()
  const { sourceFilter } = useHomeSidebar()
  const [statusFilter, setStatusFilter] = useState<SkillStatusFilter>('all')
  const [search, setSearch] = useState('')
  const [selectedSkillName, setSelectedSkillName] = useState<string | null>(null)

  const { data: installedSkills = [], isLoading, refetch: refetchInstalledSkills } = useQuery(skillsQueryOptions.installed())
  const installedSkillNames = installedSkills.map((skill) => skill.name)
  const { data: updateStatuses = [] } = useQuery({
    ...skillsQueryOptions.updates(installedSkillNames),
    enabled: installedSkillNames.length > 0
  })
  const skillsWithUpdates = new Set(updateStatuses.filter((status) => status.hasUpdate).map((status) => status.name))
  const sourceFilteredSkills = installedSkills.filter((skill) => sourceFilter === 'all' || skill.provider === sourceFilter)
  const statusCounts = {
    all: sourceFilteredSkills.length,
    updates: sourceFilteredSkills.filter((skill) => skillsWithUpdates.has(skill.name)).length,
    debug: sourceFilteredSkills.filter((skill) => skill.debugPath).length
  }
  const query = search.trim().toLowerCase()
  const filteredSkills = sourceFilteredSkills.filter((skill) => {
    if (statusFilter === 'updates' && !skillsWithUpdates.has(skill.name)) return false
    if (statusFilter === 'debug' && !skill.debugPath) return false
    if (query === '') return true

    return `${skill.name} ${skill.description} ${skill.source ?? ''}`.toLowerCase().includes(query)
  })
  const selectedSkill = filteredSkills.find((skill) => skill.name === selectedSkillName) ?? filteredSkills[0] ?? null

  async function executeSkillOperation(action: () => Promise<OperationResult>, invalidateUpdates = false): Promise<OperationResult> {
    return executeIpcOperation(async () => {
      const result = await action()
      await queryClient.invalidateQueries({ queryKey: skillsQueryKeys.installed })
      if (invalidateUpdates) await queryClient.invalidateQueries({ queryKey: skillsQueryKeys.updatesRoot })
      return result
    })
  }

  const addAgentMutation = useMutation({
    mutationFn: ({ skillName, agent }: AgentMutationVariables) =>
      executeSkillOperation(() =>
        window.api.skills.addAgents({
          names: [skillName],
          agents: [agent]
        })
      ),
    onSuccess: showOperationSuccess
  })

  const removeAgentMutation = useMutation({
    mutationFn: ({ skillName, agent }: AgentMutationVariables) =>
      executeSkillOperation(() =>
        window.api.skills.remove({
          names: [skillName],
          agents: [agent]
        })
      ),
    onSuccess: showOperationSuccess
  })

  const removeSkillMutation = useMutation({
    mutationFn: (skillName: string) =>
      executeSkillOperation(() =>
        window.api.skills.remove({
          names: [skillName],
          agents: []
        })
      ),
    onSuccess: showOperationSuccess
  })

  const updateMutation = useMutation({
    mutationFn: (skillName: string) => executeSkillOperation(() => window.api.skills.update([skillName]), true),
    onSuccess: showOperationSuccess
  })

  const startDebugMutation = useMutation({
    mutationFn: (skillName: string) => executeSkillOperation(() => window.api.skills.startDebug(skillName)),
    onSuccess: showOperationSuccess
  })

  const stopDebugMutation = useMutation({
    mutationFn: (skillName: string) => executeSkillOperation(() => window.api.skills.stopDebug(skillName)),
    onSuccess: showOperationSuccess
  })

  const openStorageFolderMutation = useMutation({
    mutationFn: (skillName: string) => executeSkillOperation(() => window.api.skills.openStorageFolder(skillName))
  })

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const installedResult = await refetchInstalledSkills()
      const names = installedResult.data?.map((skill) => skill.name) ?? []
      const statuses = names.length > 0 ? await queryClient.fetchQuery(skillsQueryOptions.updates(names)) : []
      return statuses.flatMap((status) => (status.error ? [status.error] : []))
    },
    onSuccess: (errors) => {
      if (errors.length > 0) {
        toast.danger('检查更新失败', {
          description: errors.slice(0, 3).join('\n')
        })
      } else {
        toast.success('检查完成')
      }
    },
    onError: (error) => {
      toast.danger('检查更新失败', {
        description: error instanceof Error ? error.message : String(error)
      })
    }
  })

  function toggleAgent(skill: InstalledSkill, agent: AgentId): void {
    if (skill.agents.includes(agent)) {
      removeAgentMutation.mutate({ skillName: skill.name, agent })
    } else {
      addAgentMutation.mutate({ skillName: skill.name, agent })
    }
  }

  async function copyValue(label: string, value: string): Promise<void> {
    await navigator.clipboard.writeText(value)
    toast.success(`已复制${label}`)
  }

  const busy =
    addAgentMutation.isPending ||
    removeAgentMutation.isPending ||
    removeSkillMutation.isPending ||
    updateMutation.isPending ||
    startDebugMutation.isPending ||
    stopDebugMutation.isPending ||
    openStorageFolderMutation.isPending ||
    refreshMutation.isPending
  const isRefreshing = refreshMutation.isPending

  return (
    <section className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_320px] overflow-hidden bg-background">
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden px-4 py-4">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2.5">
          <div className="flex rounded-md border border-border bg-surface p-0.5 shadow-surface">
            {STATUS_FILTERS.map((item) => {
              const isActive = statusFilter === item.id

              return (
                <button
                  key={item.id}
                  type="button"
                  className={cn(
                    'flex h-8 items-center gap-1.5 rounded-md px-3.5 text-sm font-medium transition-colors',
                    isActive ? 'bg-accent text-accent-foreground shadow-surface' : 'text-muted hover:bg-surface-hover hover:text-foreground'
                  )}
                  onClick={() => setStatusFilter(item.id)}
                >
                  <span>{item.label}</span>
                  {item.id !== 'all' && (
                    <span
                      className={cn(
                        'min-w-5 rounded-full px-1.5 py-0.5 text-xs',
                        isActive ? 'bg-accent-foreground/20 text-accent-foreground' : 'bg-warning-soft text-warning-soft-foreground'
                      )}
                    >
                      {statusCounts[item.id]}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
            <label className="flex h-9 min-w-52 max-w-68 flex-1 items-center gap-2 rounded-md border border-border bg-surface px-3 text-muted shadow-surface transition-colors focus-within:border-accent">
              <RiSearchLine size={17} className="shrink-0" />
              <input
                aria-label="搜索 Skill"
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
                placeholder="搜索 Skill"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <Button variant="secondary" className="h-9" onPress={() => refreshMutation.mutate()} isDisabled={busy} isPending={isRefreshing}>
              {({ isPending }) => (
                <span className="inline-flex items-center gap-1.5">
                  {isPending ? <Spinner color="current" size="sm" /> : <RiRefreshLine size={16} />}
                  检查更新
                </span>
              )}
            </Button>
          </div>
        </div>

        <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-surface">
          <div className="hidden shrink-0 grid-cols-[minmax(0,1fr)_132px_96px] border-b border-border px-4 py-2.5 text-sm text-muted min-[1180px]:grid">
            <div>Skill</div>
            <div>Agent</div>
            <div>状态</div>
          </div>

          {isLoading ? (
            <div className="flex min-h-0 flex-1 items-center justify-center text-muted">
              <Spinner size="sm" />
            </div>
          ) : filteredSkills.length > 0 ? (
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
              {filteredSkills.map((skill) => (
                <SkillListRow
                  key={skill.name}
                  skill={skill}
                  hasUpdate={skillsWithUpdates.has(skill.name)}
                  isSelected={selectedSkill?.name === skill.name}
                  onSelect={() => setSelectedSkillName(skill.name)}
                />
              ))}
            </div>
          ) : (
            <EmptySkillList />
          )}
        </div>
      </div>

      <SkillInspector
        skill={selectedSkill}
        hasUpdate={selectedSkill ? skillsWithUpdates.has(selectedSkill.name) : false}
        busy={busy}
        isUpdating={updateMutation.isPending && updateMutation.variables === selectedSkill?.name}
        onToggleAgent={toggleAgent}
        onOpenFolder={openStorageFolderMutation.mutate}
        onUpdate={updateMutation.mutate}
        onStartDebug={startDebugMutation.mutate}
        onStopDebug={stopDebugMutation.mutate}
        onRemove={removeSkillMutation.mutate}
        onCopy={copyValue}
      />
    </section>
  )
}

function SkillListRow({
  skill,
  hasUpdate,
  isSelected,
  onSelect
}: {
  skill: InstalledSkill
  hasUpdate: boolean
  isSelected: boolean
  onSelect: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      className={cn(
        'grid w-full gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 min-[1180px]:grid-cols-[minmax(0,1fr)_132px_96px] min-[1180px]:items-center',
        isSelected ? 'border-b-transparent bg-accent-soft/70 ring-1 ring-inset ring-accent/50' : 'hover:bg-surface-hover'
      )}
      onClick={onSelect}
    >
      <div className="flex min-w-0 items-center gap-3">
        <SourceIcon provider={skill.provider} />
        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-foreground">{skill.name}</div>
          <div className="mt-1 truncate text-sm text-muted">{skill.description}</div>
        </div>
      </div>

      <AgentBadges agents={skill.agents} />
      <SkillStatusBadges hasUpdate={hasUpdate} isDebugging={Boolean(skill.debugPath)} />
    </button>
  )
}

function AgentBadges({ agents }: { agents: AgentId[] }): React.JSX.Element {
  const installedAgents = AGENT_OPTIONS.filter((agent) => agents.includes(agent.id))

  if (installedAgents.length === 0) {
    return <div className="text-xs text-muted min-[1180px]:justify-self-start">—</div>
  }

  return (
    <div className="flex flex-wrap gap-1.5 min-[1180px]:justify-self-start">
      {installedAgents.map((agent) => (
        <span
          key={agent.id}
          className={cn(
            'rounded-md border px-2 py-0.5 text-xs font-medium',
            agent.id === 'codex'
              ? 'border-success/40 bg-success-soft text-success-soft-foreground'
              : 'border-accent/40 bg-accent-soft text-accent-soft-foreground'
          )}
        >
          {agent.shortLabel}
        </span>
      ))}
    </div>
  )
}

function SkillStatusBadges({ hasUpdate, isDebugging }: { hasUpdate: boolean; isDebugging: boolean }): React.JSX.Element {
  if (!hasUpdate && !isDebugging) return <div className="text-xs text-muted min-[1180px]:justify-self-start">—</div>

  return (
    <div className="flex flex-wrap gap-1.5 min-[1180px]:justify-self-start">
      {hasUpdate && (
        <Chip size="sm" color="warning" variant="soft">
          可更新
        </Chip>
      )}
      {isDebugging && (
        <Chip size="sm" color="warning" variant="soft">
          调试中
        </Chip>
      )}
    </div>
  )
}

function SkillInspector({
  skill,
  hasUpdate,
  busy,
  isUpdating,
  onToggleAgent,
  onOpenFolder,
  onUpdate,
  onStartDebug,
  onStopDebug,
  onRemove,
  onCopy
}: {
  skill: InstalledSkill | null
  hasUpdate: boolean
  busy: boolean
  isUpdating: boolean
  onToggleAgent: (skill: InstalledSkill, agent: AgentId) => void
  onOpenFolder: (skillName: string) => void
  onUpdate: (skillName: string) => void
  onStartDebug: (skillName: string) => void
  onStopDebug: (skillName: string) => void
  onRemove: (skillName: string) => void
  onCopy: (label: string, value: string) => Promise<void>
}): React.JSX.Element {
  if (!skill) {
    return (
      <aside className="flex h-full min-h-0 flex-col overflow-y-auto overflow-x-hidden border-l border-border bg-surface/80 px-5 py-6">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-muted">
          <RiInboxLine size={28} />
          <span>没有匹配的 Skill。</span>
        </div>
      </aside>
    )
  }

  const displayedPath = skill.debugPath || skill.storagePath
  const displayedPathLabel = skill.debugPath ? '调试路径' : '本地路径'

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden border-l border-border bg-surface/80">
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 py-6">
        <div>
          <div className="flex min-w-0 items-center gap-2.5">
            <SourceIcon provider={skill.provider} size="lg" />
            <h2 className="min-w-0 truncate text-xl font-semibold text-foreground">{skill.name}</h2>
          </div>
          <p className="mt-2 break-words text-sm leading-5 text-muted">{skill.description}</p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {skill.debugPath && (
              <Chip size="sm" color="warning" variant="soft">
                调试中
              </Chip>
            )}
            {hasUpdate && (
              <Chip size="sm" color="warning" variant="soft">
                可更新
              </Chip>
            )}
          </div>
        </div>

        <InspectorSection title="基础信息">
          <DetailRow label="来源" value={getProviderLabel(skill.provider)} />
          <DetailRow label="仓库" value={skill.source ? getRepositoryName(skill.source) : '-'} href={getRepositoryUrl(skill)} />
          <DetailRow
            label={displayedPathLabel}
            value={shortenPath(displayedPath)}
            titleValue={displayedPath}
            onOpen={() => onOpenFolder(skill.name)}
            isActionDisabled={busy}
            isMono
          />
          <DetailRow label="锁定版本" value={formatSha(skill.folderSha)} copyValue={skill.folderSha ?? undefined} onCopy={onCopy} isMono />
          <DetailRow label="安装时间" value={formatDate(skill.installedAt)} />
        </InspectorSection>

        <InspectorSection title="Agent 安装">
          <div className="overflow-hidden rounded-lg border border-border">
            {AGENT_OPTIONS.map((agent) => (
              <div key={agent.id} className="flex h-10 items-center justify-between gap-3 border-b border-border px-3 last:border-b-0">
                <span className="text-sm text-foreground">{agent.label}</span>
                <Switch
                  aria-label={`${agent.label} 安装状态`}
                  isSelected={skill.agents.includes(agent.id)}
                  isDisabled={busy}
                  onChange={() => onToggleAgent(skill, agent.id)}
                >
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </div>
            ))}
          </div>
        </InspectorSection>
      </div>

      <div className="shrink-0 border-t border-border bg-surface/95 px-4 py-3">
        <h3 className="text-xs font-semibold text-foreground">操作</h3>
        <div className={cn('mt-3 grid gap-2', hasUpdate ? 'grid-cols-3' : 'grid-cols-2')}>
          {hasUpdate && (
            <Button
              variant="outline"
              className="h-9 w-full rounded-md aria-disabled:opacity-100"
              onPress={() => onUpdate(skill.name)}
              isDisabled={busy}
              isPending={isUpdating}
            >
              {({ isPending: buttonIsPending }) => (
                <span className="inline-flex w-full items-center justify-center gap-1.5">
                  {buttonIsPending ? (
                    <span data-slot="spinner" className="inline-flex size-5 shrink-0 animate-spin text-accent">
                      <RiLoader4Line className="size-5" />
                    </span>
                  ) : (
                    <RiRefreshLine size={16} />
                  )}
                  {buttonIsPending ? '更新中' : '更新'}
                </span>
              )}
            </Button>
          )}
          <Button
            variant="outline"
            className="h-9 w-full rounded-md"
            onPress={() => (skill.debugPath ? onStopDebug(skill.name) : onStartDebug(skill.name))}
            isDisabled={busy || skill.agents.length === 0}
          >
            <span className="inline-flex w-full items-center justify-center gap-1.5">
              {skill.debugPath ? <RiStopLine size={16} /> : <RiPlayLine size={16} />}
              {skill.debugPath ? '退出' : '调试'}
            </span>
          </Button>
          <button
            type="button"
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-danger/35 bg-transparent px-3 text-sm font-medium text-danger-soft-foreground/90 transition-colors hover:border-danger/60 hover:bg-danger-soft/20 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onRemove(skill.name)}
            disabled={busy}
          >
            <RiDeleteBinLine size={16} />
            删除
          </button>
        </div>
      </div>
    </aside>
  )
}

function InspectorSection({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="mt-5 border-t border-border pt-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="mt-2.5">{children}</div>
    </section>
  )
}

function DetailRow({
  label,
  value,
  copyValue,
  titleValue,
  href,
  isMono,
  onCopy,
  onOpen,
  isActionDisabled
}: {
  label: string
  value: string
  copyValue?: string
  titleValue?: string
  href?: string
  isMono?: boolean
  onCopy?: (label: string, value: string) => Promise<void>
  onOpen?: () => void
  isActionDisabled?: boolean
}): React.JSX.Element {
  return (
    <div className="flex min-h-9 items-center justify-between gap-3 border-b border-border py-1.5 last:border-b-0">
      <span className="shrink-0 text-sm text-muted">{label}</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className={cn(
            'grid w-52 shrink-0 grid-cols-[minmax(0,1fr)_1.5rem] items-center gap-2 text-accent transition-colors hover:text-accent-soft-foreground',
            isMono && 'font-mono'
          )}
          title={href}
        >
          <span className={cn('min-w-0 truncate text-left text-sm font-medium leading-6', isMono && 'text-xs')}>{value}</span>
          <span className="inline-flex size-6 items-center justify-center">
            <RiExternalLinkLine size={15} />
          </span>
        </a>
      ) : (
        <div className="grid w-52 shrink-0 grid-cols-[minmax(0,1fr)_1.5rem] items-center gap-2">
          <span
            className={cn('min-w-0 truncate text-left text-sm leading-6 text-foreground', isMono && 'font-mono text-xs')}
            title={titleValue ?? copyValue ?? value}
          >
            {value}
          </span>
          {onOpen ? (
            <Tooltip>
              <Tooltip.Trigger className="inline-flex">
                <button
                  type="button"
                  aria-label={`打开${label}`}
                  className="inline-flex size-6 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={onOpen}
                  disabled={isActionDisabled}
                >
                  <RiFolderOpenLine size={15} />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content>打开{label}</Tooltip.Content>
            </Tooltip>
          ) : copyValue && onCopy ? (
            <Tooltip>
              <Tooltip.Trigger className="inline-flex">
                <button
                  type="button"
                  aria-label={`复制${label}`}
                  className="inline-flex size-6 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                  onClick={() => void onCopy(label, copyValue)}
                >
                  <RiFileCopyLine size={15} />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content>复制{label}</Tooltip.Content>
            </Tooltip>
          ) : (
            <span className="size-6" aria-hidden="true" />
          )}
        </div>
      )}
    </div>
  )
}

function SourceIcon({ provider, size = 'md' }: { provider?: SourceFilter; size?: 'md' | 'lg' }): React.JSX.Element {
  let Icon = RiBookOpenLine
  let toneClass = 'border-accent/30 bg-accent-soft text-accent-soft-foreground'

  if (provider === 'local') {
    Icon = RiFolderLine
    toneClass = 'border-border bg-surface-secondary text-muted'
  } else if (provider === 'gitlab') {
    Icon = RiGitlabLine
    toneClass = 'border-warning/30 bg-warning-soft text-warning-soft-foreground'
  } else if (provider === 'github') {
    Icon = RiGithubLine
    toneClass = 'border-border bg-surface-secondary text-foreground'
  }

  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-lg border', size === 'lg' ? 'size-10' : 'size-9', toneClass)}>
      <Icon size={size === 'lg' ? 22 : 19} />
    </span>
  )
}

function EmptySkillList(): React.JSX.Element {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-4 text-center text-muted">
      <RiInboxLine size={28} />
      <span>没有匹配的 Skill。</span>
    </div>
  )
}

function getProviderLabel(provider: InstalledSkill['provider']): string {
  if (provider === 'github') return 'GitHub'
  if (provider === 'gitlab') return 'GitLab'
  if (provider === 'local') return '本地'
  return '未知'
}

function getRepositoryUrl(skill: InstalledSkill): string | undefined {
  if (!skill.source) return undefined

  if (skill.provider === 'github') {
    const source = skill.source.replace(/\.git$/, '')
    return source.startsWith('http') ? source : `https://github.com/${source}`
  }

  if (skill.provider === 'gitlab' && skill.source.startsWith('http')) {
    return skill.source.replace(/\.git$/, '')
  }

  return undefined
}

function getRepositoryName(source: string): string {
  return (
    source
      .replace(/[\\/]+$/, '')
      .replace(/\.git$/, '')
      .split(/[/:\\]/)
      .at(-1) || source
  )
}

function formatDate(value?: string): string {
  return value ? new Date(value).toLocaleString() : '-'
}

function formatSha(value?: string | null): string {
  if (!value) return '-'
  return value.length > 18 ? `${value.slice(0, 18)}...` : value
}

function shortenPath(value: string): string {
  if (value.length <= 44) return value
  return `...${value.slice(-41)}`
}
