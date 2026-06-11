import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Button, Card, Checkbox, CheckboxGroup, Chip, Input, Spinner, Switch } from '@heroui/react'
import { toast } from '@heroui/react/toast'
import {
  RiCheckLine,
  RiCheckboxMultipleLine,
  RiClaudeLine,
  RiDownloadLine,
  RiGithubLine,
  RiInboxLine,
  RiOpenaiLine,
  RiRobotLine,
  RiSearchLine,
  RiTerminalBoxLine
} from '@remixicon/react'
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

const STEP_ITEMS = [
  { label: '输入', icon: RiGithubLine },
  { label: '预览', icon: RiSearchLine },
  { label: '选择 Skill', icon: RiCheckboxMultipleLine },
  { label: '选择 Agent', icon: RiRobotLine },
  { label: '安装', icon: RiDownloadLine }
]

function InstallPage(): React.JSX.Element {
  const [source, setSource] = useState('')
  const [fullDepth, setFullDepth] = useState(false)
  const [previewedSource, setPreviewedSource] = useState<string | null>(null)
  const [previews, setPreviews] = useState<SkillPreview[]>([])
  const [selectedPreviews, setSelectedPreviews] = useState<string[]>([])
  const [selectedAgents, setSelectedAgents] = useState<AgentId[]>([])
  const [logs, setLogs] = useState<string[]>([])
  const [busyLabel, setBusyLabel] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const installMutation = useMutation({
    mutationFn: window.api.skills.install
  })

  const selectedPreviewItems = useMemo(
    () => previews.filter((skill) => selectedPreviews.includes(skill.skillPath) && !skill.installState),
    [previews, selectedPreviews]
  )
  const trimmedSource = source.trim()
  const hasPreviewedSource = previewedSource === trimmedSource
  const currentStep = trimmedSource === '' ? 1 : !hasPreviewedSource ? 2 : selectedPreviewItems.length === 0 ? 3 : selectedAgents.length === 0 ? 4 : 5

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
  }

  const busy = busyLabel !== null
  const isPreviewingSource = busyLabel === '正在预览来源'
  const isInstalling = busyLabel === '正在安装 Skill'
  const canInstall = hasPreviewedSource && selectedPreviewItems.length > 0 && selectedAgents.length > 0
  const agentSelectionDisabled = busy || selectedPreviewItems.length === 0
  const isStepDisabled = (step: number): boolean => step > currentStep
  const selectedAgentLabels = AGENT_OPTIONS.filter((agent) => selectedAgents.includes(agent.id)).map((agent) => agent.label)
  const sourceSummary = trimmedSource || '等待输入'
  const statusText = busy ? busyLabel : canInstall ? '准备安装' : `等待 Step ${currentStep}`

  return (
    <section className="grid flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-4">
        <Card className="gap-0 overflow-hidden rounded-lg border border-border bg-surface p-0 shadow-surface">
          <Card.Content className="gap-4 p-4">
            <div className="flex flex-col gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">安装新 Skill</h2>
                <p className="mt-1 text-xs text-muted">按步骤预览来源、选择内容并安装到目标 Agent。</p>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {STEP_ITEMS.map((item, index) => {
                  const step = index + 1
                  const Icon = item.icon
                  const isActive = currentStep === step
                  const isDone = currentStep > step
                  const isDisabled = isStepDisabled(step)

                  return (
                    <div
                      key={item.label}
                      className={cn(
                        'min-w-0 rounded-md border px-3 py-2.5 transition-colors',
                        isActive
                          ? 'border-accent/60 bg-accent-soft text-accent-soft-foreground ring-1 ring-accent/20'
                          : isDone
                            ? 'border-accent/35 bg-accent-soft/60 text-accent-soft-foreground'
                            : 'border-border bg-surface-secondary text-muted',
                        isDisabled && 'cursor-not-allowed opacity-50'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            'flex size-7 shrink-0 items-center justify-center rounded-full border',
                            isActive
                              ? 'border-accent bg-accent text-accent-foreground'
                              : isDone
                                ? 'border-accent bg-accent text-accent-foreground'
                                : 'border-border bg-surface text-muted'
                          )}
                        >
                          {isDone ? <RiCheckLine size={14} /> : <Icon size={14} />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] leading-4 text-muted">Step {step}</div>
                          <div className="whitespace-nowrap text-[13px] font-medium leading-5">{item.label}</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </Card.Content>
        </Card>

        <Card
          className={cn(
            'gap-0 overflow-hidden rounded-lg border bg-surface p-0',
            currentStep === 1 ? 'border-accent/60' : currentStep > 1 ? 'border-accent/35' : 'border-border'
          )}
        >
          <Card.Header className="!flex-row !items-center justify-between gap-3 border-b border-separator px-5 py-3.5">
            <div className="flex items-center gap-2">
              <StepBadge step={1} currentStep={currentStep} />
              <RiGithubLine size={18} className={currentStep === 1 ? 'text-accent' : 'text-muted'} />
              <Card.Title className="text-base font-medium">输入来源</Card.Title>
            </div>
            {busy && !isPreviewingSource && (
              <div className="flex items-center gap-2 rounded-md border border-accent/30 bg-accent-soft px-3 py-2 text-sm text-accent-soft-foreground">
                <Spinner size="sm" />
                <span>{busyLabel}</span>
              </div>
            )}
          </Card.Header>
          <Card.Content className="gap-0 px-5 py-4">
            <Input
              aria-label="Source"
              placeholder="vercel-labs/agent-skills、https://gitlab.example.com/group/repo/-/tree/main/src 或 ~/skills"
              value={source}
              onChange={(event) => updateSource(event.target.value)}
              disabled={busy}
            />
          </Card.Content>
        </Card>

        <Card
          className={cn(
            'gap-0 overflow-hidden rounded-lg border bg-surface p-0',
            currentStep === 2 ? 'border-accent/60' : currentStep > 2 ? 'border-accent/35' : 'border-border',
            isStepDisabled(2) && 'cursor-not-allowed opacity-50'
          )}
        >
          <Card.Header
            className={cn(
              '!flex-row !items-center justify-between gap-3 border-b border-separator px-5 py-3.5',
              isStepDisabled(2) && 'pointer-events-none select-none'
            )}
          >
            <div className="flex items-center gap-2">
              <StepBadge step={2} currentStep={currentStep} />
              <RiSearchLine size={18} className={currentStep === 2 ? 'text-accent' : 'text-muted'} />
              <Card.Title className="text-base font-medium">预览来源</Card.Title>
            </div>
          </Card.Header>
          <Card.Content
            className={cn('!flex-row !items-center justify-between gap-3 px-5 py-4', isStepDisabled(2) && 'pointer-events-none select-none')}
          >
            <div className="grid gap-3">
              <Card.Description className="text-xs text-muted">
                {hasPreviewedSource ? `当前来源找到 ${previews.length} 个 Skill。` : '先预览当前输入的来源。'}
              </Card.Description>
              <Switch isSelected={fullDepth} onChange={updateFullDepth} isDisabled={busy}>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                <Switch.Content>
                  <div className="text-sm font-medium text-foreground">扫描所有子目录</div>
                  <div className="text-xs text-muted">默认无结果时自动递归；开启后始终扫描最多 5 层。</div>
                </Switch.Content>
              </Switch>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {isPreviewingSource && (
                <div className="flex items-center gap-2 rounded-md border border-accent/30 bg-accent-soft px-3 py-2 text-sm text-accent-soft-foreground">
                  <Spinner size="sm" />
                  <span>{busyLabel}</span>
                </div>
              )}
              <Button variant="primary" onPress={() => void previewSource()} isDisabled={busy || trimmedSource === ''}>
                <span className="inline-flex items-center gap-1.5">
                  <RiSearchLine size={16} />
                  预览
                </span>
              </Button>
            </div>
          </Card.Content>
        </Card>

        <Card
          className={cn(
            'gap-0 overflow-hidden rounded-lg border bg-surface p-0',
            currentStep === 3 ? 'border-accent/60' : currentStep > 3 ? 'border-accent/35' : 'border-border',
            isStepDisabled(3) && 'cursor-not-allowed opacity-50'
          )}
        >
          <Card.Header
            className={cn(
              '!flex-row !items-center justify-between gap-3 border-b border-separator px-5 py-3.5',
              isStepDisabled(3) && 'pointer-events-none select-none'
            )}
          >
            <div className="flex items-center gap-2">
              <StepBadge step={3} currentStep={currentStep} />
              <RiCheckboxMultipleLine size={18} className={currentStep === 3 ? 'text-accent' : 'text-muted'} />
              <Card.Title className="text-base font-medium">选择 Skill</Card.Title>
            </div>
            <Chip size="sm" variant="soft">
              已选择 {selectedPreviewItems.length} 个
            </Chip>
          </Card.Header>
          <Card.Content className={cn('gap-0 px-5 py-4', isStepDisabled(3) && 'pointer-events-none select-none')}>
            {hasPreviewedSource && previews.length > 0 && (
              <CheckboxGroup
                value={selectedPreviews}
                onChange={(value) =>
                  setSelectedPreviews(value.filter((skillPath) => !previews.find((skill) => skill.skillPath === skillPath)?.installState))
                }
                isDisabled={busy}
                className="grid gap-2 md:grid-cols-2"
              >
                {previews.map((skill) => {
                  const isSelected = selectedPreviews.includes(skill.skillPath)
                  const isBlocked = Boolean(skill.installState)

                  return (
                    <Checkbox
                      key={skill.skillPath}
                      value={skill.skillPath}
                      className={cn(
                        'rounded-md border p-3 transition-colors',
                        isBlocked
                          ? 'cursor-not-allowed border-border bg-surface-secondary opacity-70 hover:border-border hover:bg-surface-secondary'
                          : isSelected
                            ? 'border-accent/60 bg-accent-soft ring-1 ring-accent/20'
                            : 'border-border bg-surface'
                      )}
                      isDisabled={isBlocked}
                    >
                      <Checkbox.Control className="mt-0.5">
                        {isSelected && (
                          <Checkbox.Indicator>
                            <RiCheckLine size={14} />
                          </Checkbox.Indicator>
                        )}
                      </Checkbox.Control>
                      <Checkbox.Content className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-foreground">{skill.name}</span>
                          {isSelected && (
                            <Chip size="sm" color="accent" variant="soft">
                              已选择
                            </Chip>
                          )}
                          {skill.installState === 'installed' && (
                            <Chip size="sm" variant="soft">
                              已安装
                            </Chip>
                          )}
                          {skill.installState === 'conflict' && (
                            <Chip size="sm" color="danger" variant="soft">
                              同名冲突
                            </Chip>
                          )}
                        </div>
                        <p className="mt-1 text-xs leading-5 text-muted">{skill.description}</p>
                        {skill.installMessage && <p className="mt-1 text-xs leading-5 text-danger-soft-foreground">{skill.installMessage}</p>}
                        <Chip className="mt-2 max-w-full font-mono text-[11px]" size="sm" color={isSelected ? 'accent' : 'default'} variant="soft">
                          <span className="truncate">{skill.skillPath}</span>
                        </Chip>
                      </Checkbox.Content>
                    </Checkbox>
                  )
                })}
              </CheckboxGroup>
            )}
            {!hasPreviewedSource && <EmptyState text="先预览一个 GitHub、GitLab 或本地目录来源。" />}
            {hasPreviewedSource && previews.length === 0 && <EmptyState text="当前来源没有找到 Skill。" />}
          </Card.Content>
        </Card>

        <Card
          className={cn(
            'gap-0 overflow-hidden rounded-lg border bg-surface p-0',
            currentStep === 4 ? 'border-accent/60' : currentStep > 4 ? 'border-accent/35' : 'border-border',
            isStepDisabled(4) && 'cursor-not-allowed opacity-50'
          )}
        >
          <Card.Header
            className={cn(
              '!flex-row !items-center justify-between gap-3 border-b border-separator px-5 py-3.5',
              isStepDisabled(4) && 'pointer-events-none select-none'
            )}
          >
            <div className="flex items-center gap-2">
              <StepBadge step={4} currentStep={currentStep} />
              <RiRobotLine size={18} className={currentStep === 4 ? 'text-accent' : 'text-muted'} />
              <Card.Title className="text-base font-medium">选择 Agent</Card.Title>
            </div>
            <Chip size="sm" variant="soft">
              已选择 {selectedAgents.length} 个
            </Chip>
          </Card.Header>
          <Card.Content className={cn('gap-0 px-5 py-4', isStepDisabled(4) && 'pointer-events-none select-none')}>
            {selectedPreviewItems.length === 0 && <p className="mb-3 text-xs text-muted">请先选择至少一个 Skill。</p>}
            <CheckboxGroup
              value={selectedAgents}
              onChange={(value) => setSelectedAgents(value as AgentId[])}
              isDisabled={agentSelectionDisabled}
              className="grid gap-2 sm:grid-cols-2"
            >
              {AGENT_OPTIONS.map((agent) => {
                const Icon = agent.icon
                const isSelected = selectedAgents.includes(agent.id)

                return (
                  <Checkbox
                    key={agent.id}
                    value={agent.id}
                    className={cn(
                      'rounded-md border p-3 transition-colors',
                      isSelected ? 'border-accent bg-accent-soft ring-1 ring-accent/40' : 'border-border bg-surface'
                    )}
                  >
                    <Checkbox.Control>
                      {isSelected && (
                        <Checkbox.Indicator>
                          <RiCheckLine size={14} />
                        </Checkbox.Indicator>
                      )}
                    </Checkbox.Control>
                    <Checkbox.Content>
                      <div className="flex flex-wrap items-center gap-2">
                        <Icon size={18} className={isSelected ? 'text-accent-soft-foreground' : 'text-muted'} />
                        <span className={isSelected ? 'font-medium text-accent-soft-foreground' : 'font-medium text-foreground'}>{agent.label}</span>
                        {isSelected && (
                          <Chip size="sm" color="accent" variant="soft">
                            已选择
                          </Chip>
                        )}
                      </div>
                    </Checkbox.Content>
                  </Checkbox>
                )
              })}
            </CheckboxGroup>
          </Card.Content>
        </Card>

        <Card
          className={cn(
            'gap-0 overflow-hidden rounded-lg border bg-surface p-0',
            currentStep === 5 ? 'border-accent/60' : 'border-border',
            isStepDisabled(5) && 'cursor-not-allowed opacity-50'
          )}
        >
          <Card.Content
            className={cn('!flex-row !items-center justify-between gap-3 px-5 py-4', isStepDisabled(5) && 'pointer-events-none select-none')}
          >
            <div>
              <div className="flex items-center gap-2">
                <StepBadge step={5} currentStep={currentStep} />
                <RiDownloadLine size={18} className={currentStep === 5 ? 'text-accent' : 'text-muted'} />
                <Card.Title className="text-base font-medium">安装</Card.Title>
              </div>
              <Card.Description className="mt-1 text-xs text-muted">
                将 {selectedPreviewItems.length} 个 Skill 安装到 {selectedAgents.length} 个 Agent。
              </Card.Description>
            </div>
            <Button variant="primary" onPress={() => void installSkills()} isDisabled={busy || !canInstall} isPending={isInstalling}>
              {({ isPending }) => (
                <span className="inline-flex items-center gap-1.5">
                  {isPending ? <Spinner color="current" size="sm" /> : <RiDownloadLine size={16} />}
                  安装
                </span>
              )}
            </Button>
          </Card.Content>
        </Card>
      </div>

      <Card className="gap-0 overflow-hidden rounded-lg border border-border bg-surface p-0 shadow-surface xl:sticky xl:top-6 xl:self-start">
        <Card.Header className="!flex-row !items-center gap-2 border-b border-separator px-4 py-3">
          <RiTerminalBoxLine size={18} className="text-accent" />
          <Card.Title className="text-base font-medium">安装摘要</Card.Title>
        </Card.Header>
        <Card.Content className="grid gap-3 p-3">
          <div className="grid gap-2">
            <SummaryRow label="来源" value={sourceSummary} />
            <SummaryRow label="Skill" value={`${selectedPreviewItems.length} / ${previews.length}`} />
            <SummaryRow label="Agent" value={selectedAgentLabels.length > 0 ? selectedAgentLabels.join(', ') : '等待选择'} />
            <SummaryRow label="状态" value={statusText || '空闲'} isAccent={busy || canInstall} />
          </div>
          <div>
            <div className="mb-2 text-sm font-medium text-foreground">操作日志</div>
            <div className="min-h-28 rounded-md border border-border bg-surface-secondary p-3 font-mono text-xs leading-5 text-muted">
              {logs.length > 0 ? logs.map((line, index) => <div key={`${line}-${index}`}>{line}</div>) : '暂无操作记录。'}
            </div>
          </div>
        </Card.Content>
      </Card>
    </section>
  )
}

function StepBadge({ step, currentStep }: { step: number; currentStep: number }): React.JSX.Element {
  const isActive = currentStep === step
  const isDone = currentStep > step

  return (
    <span
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium',
        isActive
          ? 'border-accent bg-accent text-accent-foreground'
          : isDone
            ? 'border-accent bg-accent text-accent-foreground'
            : 'border-border bg-surface-secondary text-muted'
      )}
    >
      {isDone ? <RiCheckLine size={14} /> : step}
    </span>
  )
}

function SummaryRow({ label, value, isAccent = false }: { label: string; value: string; isAccent?: boolean }): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-surface-secondary p-2.5">
      <div className="text-xs text-muted">{label}</div>
      <div className={cn('mt-1 truncate text-sm font-medium', isAccent ? 'text-accent-soft-foreground' : 'text-foreground')}>{value}</div>
    </div>
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
