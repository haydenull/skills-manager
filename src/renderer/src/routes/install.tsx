import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Checkbox, CheckboxGroup, Spinner } from '@heroui/react'
import { toast } from '@heroui/react/toast'
import { RiCheckLine, RiClaudeLine, RiDownloadLine, RiInboxLine, RiOpenaiLine, RiRobotLine, RiSearchLine } from '@remixicon/react'
import type { AgentId, OperationResult, SkillPreview } from '../../../shared/skills-types'
import { cn } from '../lib/cn'
import { skillsQueryKeys } from '../skills-queries'

export const Route = createFileRoute('/install')({
  component: InstallPage
})

const AGENT_OPTIONS = [
  { id: 'claude-code', label: 'Claude Code', icon: RiClaudeLine },
  { id: 'codex', label: 'Codex', icon: RiOpenaiLine }
] satisfies Array<{ id: AgentId; label: string; icon: typeof RiRobotLine }>

function InstallPage(): React.JSX.Element {
  const [source, setSource] = useState('')
  const [fullDepth, setFullDepth] = useState(false)
  const [localPathExample, setLocalPathExample] = useState('~/skills')
  const [previewedSource, setPreviewedSource] = useState<string | null>(null)
  const [previews, setPreviews] = useState<SkillPreview[]>([])
  const [selectedPreviews, setSelectedPreviews] = useState<string[]>([])
  const [selectedAgents, setSelectedAgents] = useState<AgentId[]>([])
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [busyLabel, setBusyLabel] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const installMutation = useMutation({
    mutationFn: window.api.skills.install
  })

  useEffect(() => {
    window.api.app.getInfo().then((info) => {
      setLocalPathExample(info.platform === 'win32' ? 'C:\\Users\\me\\skills' : '~/skills')
    })
  }, [])

  const selectedPreviewItems = previews.filter((skill) => selectedPreviews.includes(skill.skillPath) && !skill.installState)
  const trimmedSource = source.trim()
  const hasPreviewedSource = previewedSource === trimmedSource

  async function run(label: string, action: () => Promise<OperationResult | void>): Promise<void> {
    setBusyLabel(label)
    setStatusMessage(`${label}...`)

    try {
      const result = await action()
      if (result) {
        setStatusMessage(result.logs[0] ?? (result.ok ? '完成。' : '失败。'))
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusyLabel(null)
    }
  }

  async function previewSource(): Promise<void> {
    await run('正在预览来源', async () => {
      const skills = await window.api.skills.previewSource(trimmedSource, fullDepth)
      setPreviewedSource(trimmedSource)
      setPreviews(skills)
      setSelectedPreviews([])
      setSelectedAgents([])
      return {
        ok: true,
        logs: skills.length > 0 ? [`找到 ${skills.length} 个 Skill。`] : ['没有找到 Skill。']
      }
    })
  }

  async function installSkills(): Promise<void> {
    await run('正在安装 Skill', async () => {
      const installedCount = selectedPreviewItems.length
      const installedAgentLabels = selectedAgentLabels.join(', ')
      const result = await installMutation.mutateAsync({
        source: trimmedSource,
        skills: selectedPreviewItems,
        agents: selectedAgents,
        fullDepth
      })
      await queryClient.invalidateQueries({ queryKey: skillsQueryKeys.installed })
      if (result.ok) {
        const skills = await window.api.skills.previewSource(trimmedSource, fullDepth)
        setPreviewedSource(trimmedSource)
        setPreviews(skills)
        setSelectedPreviews([])
        setSelectedAgents([])
        toast.success('安装完成', {
          description: `已安装 ${installedCount} 个 Skill 到 ${installedAgentLabels}。`
        })
      } else {
        toast.danger('安装失败', {
          description: result.logs.slice(0, 3).join('\n') || '请稍后重试。'
        })
      }
      return result
    })
  }

  function updateSource(value: string): void {
    setSource(value)
    resetPreview()
  }

  function updateFullDepth(value: boolean): void {
    setFullDepth(value)
    resetPreview()
  }

  function resetPreview(): void {
    setPreviewedSource(null)
    setPreviews([])
    setSelectedPreviews([])
    setSelectedAgents([])
    setStatusMessage(null)
  }

  const busy = busyLabel !== null
  const isPreviewingSource = busyLabel === '正在预览来源'
  const isInstalling = busyLabel === '正在安装 Skill'
  const canInstall = hasPreviewedSource && selectedPreviewItems.length > 0 && selectedAgents.length > 0
  const agentSelectionDisabled = busy || selectedPreviewItems.length === 0
  const selectedAgentLabels = AGENT_OPTIONS.filter((agent) => selectedAgents.includes(agent.id)).map((agent) => agent.label)
  const foundCount = hasPreviewedSource ? previews.length : 0
  const installableCount = hasPreviewedSource ? previews.filter((skill) => !skill.installState).length : 0
  const statusText =
    busyLabel ?? (canInstall ? '准备安装' : (statusMessage ?? (hasPreviewedSource ? '等待选择' : trimmedSource ? '等待预览' : '等待输入来源')))

  return (
    <section className="flex h-full min-h-0 flex-col overflow-clip bg-background px-8 py-7 text-foreground">
      <header className="shrink-0">
        <h2 className="text-xl font-semibold leading-8 text-foreground">安装</h2>
        <p className="mt-1 text-sm text-muted">选择要安装的 Skill。路径隐藏，描述优先。</p>
      </header>

      <section className="mt-5 shrink-0 rounded-lg border border-border bg-surface px-5 py-4 shadow-surface">
        <div className="grid items-center gap-4 min-[1180px]:grid-cols-[minmax(0,1fr)_178px_136px_84px_96px]">
          <label className="min-w-0">
            <span className="flex h-9 min-w-0 items-center rounded-md border border-border bg-background px-3 transition-colors focus-within:border-accent">
              <input
                aria-label="来源"
                className="min-w-0 flex-1 bg-transparent font-mono text-xs text-foreground outline-none placeholder:text-muted"
                placeholder={`vercel-labs/agent-skills、https://gitlab.example.com/group/repo/-/tree/main/src 或 ${localPathExample}`}
                value={source}
                onChange={(event) => updateSource(event.target.value)}
                disabled={busy}
              />
            </span>
          </label>

          <SubdirectoryToggle isSelected={fullDepth} isDisabled={busy} onChange={() => updateFullDepth(!fullDepth)} />

          <button
            type="button"
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-accent px-4 text-[13px] font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-45"
            onClick={() => void previewSource()}
            disabled={busy || trimmedSource === ''}
          >
            {isPreviewingSource ? <Spinner color="current" size="sm" /> : <RiSearchLine size={16} />}
            <span>预览</span>
          </button>

          <InstallMetric label="找到" value={foundCount} />
          <InstallMetric label="可安装" value={installableCount} isSuccess />
        </div>
      </section>

      <div className="mt-5 grid min-h-0 flex-1 items-stretch gap-5 overflow-clip xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex min-h-0 min-w-0 flex-col overflow-clip rounded-lg border border-border bg-surface shadow-surface">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4">
            <h3 className="text-base font-semibold text-foreground">候选 Skill</h3>
            <div className="text-sm text-accent-soft-foreground">已选择 {selectedPreviewItems.length} 个</div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
            {hasPreviewedSource && previews.length > 0 && (
              <CheckboxGroup
                value={selectedPreviews}
                onChange={(value) =>
                  setSelectedPreviews(value.filter((skillPath) => !previews.find((skill) => skill.skillPath === skillPath)?.installState))
                }
                isDisabled={busy}
                className="grid gap-3"
              >
                {previews.map((skill) => (
                  <SkillPreviewOption key={skill.skillPath} skill={skill} isSelected={selectedPreviews.includes(skill.skillPath)} />
                ))}
              </CheckboxGroup>
            )}
            {!hasPreviewedSource && <EmptyState text="先预览一个 GitHub、GitLab 或本地目录来源。" />}
            {hasPreviewedSource && previews.length === 0 && <EmptyState text="当前来源没有找到 Skill。" />}
          </div>
        </section>

        <aside className="flex min-h-0 flex-col overflow-clip rounded-lg border border-border bg-surface shadow-surface">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
            <h3 className="text-base font-semibold text-foreground">安装到</h3>

            <CheckboxGroup
              value={selectedAgents}
              onChange={(value) => setSelectedAgents(value as AgentId[])}
              isDisabled={agentSelectionDisabled}
              className="mt-6 grid gap-3"
            >
              {AGENT_OPTIONS.map((agent) => (
                <AgentInstallOption key={agent.id} agent={agent} isSelected={selectedAgents.includes(agent.id)} />
              ))}
            </CheckboxGroup>

            <section className="mt-5 border-t border-border pt-4">
              <div className="text-xs font-medium text-muted">将安装</div>
              {selectedPreviewItems.length > 0 ? (
                <div className="mt-3 max-h-28 overflow-y-auto overscroll-contain pr-1 text-sm text-foreground">
                  {selectedPreviewItems.map((skill) => (
                    <div key={skill.skillPath} className="truncate py-1" title={skill.name}>
                      {skill.name}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 text-sm text-muted">等待选择候选 Skill。</div>
              )}
            </section>
          </div>

          <div className="shrink-0 border-t border-border px-5 py-4">
            <button
              type="button"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-45"
              onClick={() => void installSkills()}
              disabled={busy || !canInstall}
            >
              {isInstalling ? <Spinner color="current" size="sm" /> : <RiDownloadLine size={18} />}
              <span>安装 {selectedPreviewItems.length} 个 Skill</span>
            </button>
            <div
              className={cn('mt-3 break-words text-xs leading-5', canInstall || busy ? 'text-success-soft-foreground' : 'text-muted')}
              title={statusText}
            >
              状态：{statusText}
            </div>
            {selectedAgentLabels.length > 0 && <div className="mt-1 truncate text-xs text-muted">Agent：{selectedAgentLabels.join(', ')}</div>}
          </div>
        </aside>
      </div>
    </section>
  )
}

function InstallMetric({ label, value, isSuccess = false }: { label: string; value: number; isSuccess?: boolean }): React.JSX.Element {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted">{label}</div>
      <div className={cn('mt-0.5 whitespace-nowrap text-2xl leading-7', isSuccess ? 'text-success-soft-foreground' : 'text-foreground')}>
        {value} 个
      </div>
    </div>
  )
}

function SubdirectoryToggle({
  isSelected,
  isDisabled,
  onChange
}: {
  isSelected: boolean
  isDisabled: boolean
  onChange: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isSelected}
      className={cn(
        'inline-flex h-9 w-full items-center gap-2.5 rounded-md border px-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/25',
        isSelected
          ? 'border-accent/45 bg-background text-accent-soft-foreground'
          : 'border-border bg-background text-muted hover:bg-surface-secondary/60 hover:text-foreground',
        isDisabled && 'cursor-not-allowed opacity-60'
      )}
      onClick={onChange}
      disabled={isDisabled}
    >
      <span
        className={cn(
          'inline-flex size-4 shrink-0 rounded-full border transition-colors',
          isSelected ? 'border-accent bg-accent ring-2 ring-accent/15' : 'border-border bg-muted/70'
        )}
      />
      <span className="min-w-0 truncate text-[13px] font-medium">扫描所有子目录</span>
    </button>
  )
}

function SkillPreviewOption({ skill, isSelected }: { skill: SkillPreview; isSelected: boolean }): React.JSX.Element {
  const isBlocked = Boolean(skill.installState)

  return (
    <Checkbox
      value={skill.skillPath}
      className={cn(
        'rounded-lg border px-4 py-4 transition-colors',
        isBlocked
          ? 'cursor-not-allowed border-border bg-surface-secondary/70 opacity-75 hover:border-border hover:bg-surface-secondary/70'
          : isSelected
            ? 'border-accent bg-accent-soft/80 ring-1 ring-accent/40'
            : 'border-border bg-surface hover:border-accent/45 hover:bg-surface-hover'
      )}
      isDisabled={isBlocked}
    >
      <Checkbox.Control
        className={cn(
          'mt-1 size-5 shrink-0 rounded border bg-surface-secondary text-accent-foreground',
          isSelected ? 'border-accent bg-accent' : 'border-border'
        )}
      >
        {isSelected && (
          <Checkbox.Indicator>
            <RiCheckLine size={14} />
          </Checkbox.Indicator>
        )}
      </Checkbox.Control>
      <Checkbox.Content className="min-w-0 flex-1">
        <div className="grid min-w-0 gap-3 min-[1024px]:grid-cols-[minmax(0,1fr)_96px] min-[1024px]:items-start">
          <div className="min-w-0">
            <div className="truncate text-base font-medium text-foreground" title={skill.name}>
              {skill.name}
            </div>
            <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted">{skill.description}</p>
            {skill.installMessage && <p className="mt-1 line-clamp-2 text-xs leading-5 text-danger-soft-foreground">{skill.installMessage}</p>}
          </div>
          <PreviewStateBadge state={skill.installState} />
        </div>
      </Checkbox.Content>
    </Checkbox>
  )
}

function PreviewStateBadge({ state }: { state?: SkillPreview['installState'] }): React.JSX.Element {
  if (state === 'conflict') {
    return (
      <span className="inline-flex h-7 w-fit items-center justify-center rounded-md border border-danger/35 bg-danger-soft px-3 text-xs font-medium text-danger-soft-foreground min-[1024px]:justify-self-end">
        同名冲突
      </span>
    )
  }

  if (state === 'installed') {
    return (
      <span className="inline-flex h-7 w-fit items-center justify-center rounded-md border border-border bg-surface-secondary px-3 text-xs font-medium text-muted min-[1024px]:justify-self-end">
        已安装
      </span>
    )
  }

  return (
    <span className="inline-flex h-7 w-fit items-center justify-center rounded-md border border-success/35 bg-success-soft px-3 text-xs font-medium text-success-soft-foreground min-[1024px]:justify-self-end">
      可安装
    </span>
  )
}

function AgentInstallOption({ agent, isSelected }: { agent: (typeof AGENT_OPTIONS)[number]; isSelected: boolean }): React.JSX.Element {
  const Icon = agent.icon

  return (
    <Checkbox
      value={agent.id}
      className={cn(
        'rounded-md border px-3 py-3 transition-colors',
        isSelected ? 'border-accent bg-accent-soft ring-1 ring-accent/35' : 'border-border bg-surface hover:border-accent/45 hover:bg-surface-hover'
      )}
    >
      <Checkbox.Control
        className={cn(
          'size-5 shrink-0 rounded border bg-surface-secondary text-accent-foreground',
          isSelected ? 'border-accent bg-accent' : 'border-border'
        )}
      >
        {isSelected && (
          <Checkbox.Indicator>
            <RiCheckLine size={14} />
          </Checkbox.Indicator>
        )}
      </Checkbox.Control>
      <Checkbox.Content>
        <div className="flex min-w-0 items-center gap-2.5">
          <Icon size={18} className={isSelected ? 'text-accent-soft-foreground' : 'text-muted'} />
          <span className={cn('truncate text-sm font-medium', isSelected ? 'text-accent-soft-foreground' : 'text-foreground')}>{agent.label}</span>
        </div>
      </Checkbox.Content>
    </Checkbox>
  )
}

function EmptyState({ text }: { text: string }): React.JSX.Element {
  return (
    <div className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border bg-surface-secondary px-3 py-6 text-center text-sm text-muted">
      <RiInboxLine size={22} className="shrink-0" />
      <span>{text}</span>
    </div>
  )
}
