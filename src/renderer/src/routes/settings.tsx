import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Button, Input, Spinner, Tooltip, useTheme } from '@heroui/react'
import { toast } from '@heroui/react/toast'
import {
  RiComputerLine,
  RiDeleteBinLine,
  RiDownloadLine,
  RiFileCopyLine,
  RiFolderLine,
  RiFolderOpenLine,
  RiKey2Line,
  RiMoonLine,
  RiRefreshLine,
  RiRestartLine,
  RiSaveLine,
  RiSettings3Line,
  RiSunLine
} from '@remixicon/react'
import { useEffect, useState } from 'react'
import type { AgentId, AppInfo, AppUpdateStatus, SettingsFolderTarget } from '../../../shared/skills-types'
import { cn } from '../lib/cn'
import { executeIpcOperation, IpcOperationError } from '../lib/execute-ipc-operation'
import { skillsQueryOptions } from '../skills-queries'

export const Route = createFileRoute('/settings')({
  component: SettingsPage
})

function getIpcErrorMessage(error: unknown): string {
  if (error instanceof IpcOperationError) return error.logs.join('\n')
  return error instanceof Error ? error.message : String(error)
}

function SettingsPage(): React.JSX.Element {
  const settingsQuery = useQuery(skillsQueryOptions.settingsInfo())
  const settings = settingsQuery.data
  const { resolvedTheme, setTheme, theme } = useTheme('dark')
  const [openError, setOpenError] = useState('')
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [updateStatus, setUpdateStatus] = useState<AppUpdateStatus | null>(null)
  const [updateBusy, setUpdateBusy] = useState('')
  const [gitlabHost, setGitlabHost] = useState('')
  const [gitlabToken, setGitlabToken] = useState('')
  const [gitlabBusy, setGitlabBusy] = useState('')
  const [gitlabMessage, setGitlabMessage] = useState('')
  const currentTheme = resolvedTheme ?? theme

  useEffect(() => {
    executeIpcOperation(() => window.api.app.getInfo())
      .then(setAppInfo)
      .catch(() => undefined)
  }, [])

  useEffect(() => window.api.app.onUpdateStatus(setUpdateStatus), [])

  async function openFolder(target: SettingsFolderTarget, agentId?: AgentId): Promise<void> {
    setOpenError('')
    try {
      await executeIpcOperation(() => window.api.skills.openSettingsFolder(target, agentId), { skipErrorHandler: true })
    } catch (error) {
      setOpenError(getIpcErrorMessage(error))
    }
  }

  async function checkUpdates(): Promise<void> {
    setUpdateBusy('check')
    try {
      setUpdateStatus(await executeIpcOperation(() => window.api.app.checkForUpdates()))
    } catch {
      return
    } finally {
      setUpdateBusy('')
    }
  }

  async function openReleasePage(): Promise<void> {
    setUpdateBusy('release')
    try {
      await executeIpcOperation(() => window.api.app.openReleasePage())
    } catch {
      return
    } finally {
      setUpdateBusy('')
    }
  }

  async function saveGitLabToken(): Promise<void> {
    setGitlabBusy('save')
    setGitlabMessage('')
    try {
      const result = await executeIpcOperation(() => window.api.skills.saveGitLabToken(gitlabHost, gitlabToken), { skipErrorHandler: true })
      setGitlabMessage(result.logs.join('\n'))
      setGitlabHost('')
      setGitlabToken('')
      await settingsQuery.refetch()
    } catch (error) {
      setGitlabMessage(getIpcErrorMessage(error))
    } finally {
      setGitlabBusy('')
    }
  }

  async function deleteGitLabToken(host: string): Promise<void> {
    setGitlabBusy(host)
    setGitlabMessage('')
    try {
      const result = await executeIpcOperation(() => window.api.skills.deleteGitLabToken(host), { skipErrorHandler: true })
      setGitlabMessage(result.logs.join('\n'))
      await settingsQuery.refetch()
    } catch (error) {
      setGitlabMessage(getIpcErrorMessage(error))
    } finally {
      setGitlabBusy('')
    }
  }

  async function copyGitLabToken(host: string): Promise<void> {
    setGitlabBusy(`copy:${host}`)
    let token: string
    try {
      token = await executeIpcOperation(() => window.api.skills.getGitLabToken(host))
    } catch {
      setGitlabBusy('')
      return
    }

    try {
      if (token) {
        await navigator.clipboard.writeText(token)
        toast.success('已复制 GitLab token', {
          description: host
        })
      } else {
        toast.danger('未找到 GitLab token', {
          description: host
        })
      }
    } finally {
      setGitlabBusy('')
    }
  }

  if (!settings) {
    return (
      <section className="h-full min-h-0 overflow-y-auto overflow-x-hidden bg-background px-4 py-4 text-foreground">
        <div className="flex min-h-64 items-center justify-center rounded-lg border border-border bg-surface p-8 text-muted shadow-surface">
          <Spinner size="sm" />
        </div>
      </section>
    )
  }

  return (
    <section className="h-full min-h-0 overflow-y-auto overflow-x-hidden bg-background px-4 py-4 text-foreground">
      <div className="mx-auto max-w-[1180px]">
        <header className="flex items-center gap-2.5">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-accent/35 bg-accent-soft text-accent-soft-foreground">
            <RiSettings3Line size={18} />
          </span>
          <div>
            <h2 className="text-base font-semibold leading-6 text-foreground">设置</h2>
            <p className="text-xs text-muted">外观、更新、凭据与本地目录</p>
          </div>
        </header>

        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
          <AppearanceCard theme={theme} resolvedTheme={currentTheme} onThemeChange={setTheme} />
          <UpdateRow
            version={appInfo?.version}
            status={updateStatus}
            busy={updateBusy}
            onCheck={() => void checkUpdates()}
            onOpenReleasePage={() => void openReleasePage()}
          />
        </div>

        <div className="mt-3 grid gap-3">
          <GitLabTokenRow
            hosts={settings.gitlabTokenHosts}
            host={gitlabHost}
            token={gitlabToken}
            busy={gitlabBusy}
            message={gitlabMessage}
            onHostChange={setGitlabHost}
            onTokenChange={setGitlabToken}
            onSave={() => void saveGitLabToken()}
            onCopy={(host) => void copyGitLabToken(host)}
            onDelete={(host) => void deleteGitLabToken(host)}
          />
          <LocalFoldersCard
            appDataPath={settings.appDataPath}
            agents={settings.agents}
            onOpenAppData={() => void openFolder('app-data')}
            onOpenAgent={(agentId) => void openFolder('agent-skills', agentId)}
          />
          {openError && (
            <div className="rounded-lg border border-danger-soft bg-danger-soft p-3 text-xs text-danger-soft-foreground">{openError}</div>
          )}
        </div>
      </div>
    </section>
  )
}

type AppTheme = 'system' | 'light' | 'dark'

const THEME_OPTIONS = [
  { id: 'system', label: '跟随系统', icon: RiComputerLine },
  { id: 'light', label: '浅色', icon: RiSunLine },
  { id: 'dark', label: '深色', icon: RiMoonLine }
] satisfies Array<{ id: AppTheme; label: string; icon: typeof RiSunLine }>

function AppearanceCard({
  theme,
  resolvedTheme,
  onThemeChange
}: {
  theme: string
  resolvedTheme: string | undefined
  onThemeChange: (theme: string) => void
}): React.JSX.Element {
  const resolvedLabel = resolvedTheme === 'light' ? '浅色' : '深色'
  const intentLabel = THEME_OPTIONS.find((item) => item.id === theme)?.label ?? '自定义'

  return (
    <div className="min-w-0 rounded-lg border border-border bg-surface p-4 shadow-surface">
      <div className="flex items-start gap-2.5">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-accent/35 bg-accent-soft text-accent-soft-foreground">
          <RiComputerLine size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">外观</div>
          <div className="mt-0.5 text-xs text-muted">{theme === 'system' ? `跟随系统，当前为${resolvedLabel}` : `当前为${intentLabel}`}</div>

          <div className="mt-3">
            <div className="grid grid-cols-3 rounded-md border border-border bg-surface-secondary p-0.5">
              {THEME_OPTIONS.map((item) => {
                const isSelected = theme === item.id

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={cn(
                      'inline-flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium transition-colors',
                      isSelected ? 'bg-accent text-accent-foreground shadow-surface' : 'text-muted hover:bg-surface-hover hover:text-foreground'
                    )}
                    onClick={() => onThemeChange(item.id)}
                  >
                    <item.icon size={15} className="shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function GitLabTokenRow({
  hosts,
  host,
  token,
  busy,
  message,
  onHostChange,
  onTokenChange,
  onSave,
  onCopy,
  onDelete
}: {
  hosts: string[]
  host: string
  token: string
  busy: string
  message: string
  onHostChange: (value: string) => void
  onTokenChange: (value: string) => void
  onSave: () => void
  onCopy: (host: string) => void
  onDelete: (host: string) => void
}): React.JSX.Element {
  const isSaving = busy === 'save'

  return (
    <div className="min-w-0 rounded-lg border border-border bg-surface p-4 shadow-surface">
      <div className="flex items-start gap-2.5">
        <RiKey2Line size={17} className="mt-0.5 shrink-0 text-warning" />
        <div>
          <div className="text-base font-semibold leading-6 text-foreground">GitLab Token</div>
          <div className="text-xs text-muted">私有 GitLab 源访问凭据</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)_144px] gap-3">
        <label className="grid gap-1.5">
          <span className="text-xs text-muted">Host</span>
          <Input aria-label="GitLab Host" placeholder="gitlab.corp.youdao.com" value={host} onChange={(event) => onHostChange(event.target.value)} />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs text-muted">Token</span>
          <Input
            aria-label="GitLab Token"
            type="password"
            placeholder="Personal access token"
            value={token}
            onChange={(event) => onTokenChange(event.target.value)}
          />
        </label>
        <Button variant="primary" className="h-9 self-end" onPress={onSave} isPending={isSaving} isDisabled={busy !== ''}>
          {({ isPending }) => (
            <span className="inline-flex items-center gap-1.5">
              {isPending ? <Spinner color="current" size="sm" /> : <RiSaveLine size={16} />}
              保存
            </span>
          )}
        </Button>
      </div>

      {hosts.length > 0 && (
        <div className="mt-4 grid gap-2 border-t border-border pt-3">
          {hosts.map((configuredHost) => (
            <div
              key={configuredHost}
              className="grid min-w-0 gap-2 rounded-md border border-border bg-surface-secondary px-3 py-2 sm:grid-cols-[88px_minmax(0,1fr)_auto] sm:items-center"
            >
              <div className="text-xs text-muted">已配置</div>
              <div className="flex min-w-0 items-center gap-3">
                <span className="min-w-0 truncate text-sm font-medium text-foreground" title={configuredHost}>
                  {configuredHost}
                </span>
                <span className="shrink-0 rounded-md border border-success/35 bg-success-soft px-2 py-0.5 text-xs font-medium text-success-soft-foreground">
                  已配置
                </span>
              </div>
              <div className="flex items-center gap-2 justify-self-start sm:justify-self-end">
                <IconActionButton
                  label={`复制 ${configuredHost} token`}
                  tooltip="复制"
                  icon={busy === `copy:${configuredHost}` ? 'spinner' : 'copy'}
                  disabled={busy !== ''}
                  onClick={() => onCopy(configuredHost)}
                />
                <IconActionButton
                  label={`删除 ${configuredHost} token`}
                  tooltip="删除"
                  icon={busy === configuredHost ? 'spinner' : 'delete'}
                  tone="danger"
                  disabled={busy !== ''}
                  onClick={() => onDelete(configuredHost)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {message && <div className="mt-3 rounded-md border border-border bg-surface-secondary px-3 py-2 text-xs leading-5 text-muted">{message}</div>}
    </div>
  )
}

function UpdateRow({
  version,
  status,
  busy,
  onCheck,
  onOpenReleasePage
}: {
  version?: string
  status: AppUpdateStatus | null
  busy: string
  onCheck: () => void
  onOpenReleasePage: () => void
}): React.JSX.Element {
  const isBusy = busy !== ''
  const hasUpdate = status?.status === 'available'
  const isError = status?.status === 'error'
  const message = getUpdateMessage(status)

  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-surface">
      <div className="flex h-full flex-col justify-between gap-4">
        <div className="flex items-start gap-2.5">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-accent/35 bg-accent-soft text-accent-soft-foreground">
            <RiRestartLine size={18} />
          </span>
          <div>
            <div className="text-sm font-semibold text-foreground">关于与更新</div>
            <div className="mt-0.5 text-xs text-muted">当前版本 v{version ?? '-'}</div>
            {status?.update && <div className="mt-0.5 text-xs text-muted">最新版本 v{status.update.version}</div>}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="grid gap-2 sm:grid-cols-[4rem_auto] sm:items-center">
            <span className="text-xs text-muted">更新状态</span>
            <span
              className={cn(
                'inline-flex h-7 w-fit items-center rounded-md border px-3 text-xs',
                isError
                  ? 'border-danger/30 bg-danger-soft text-danger-soft-foreground'
                  : hasUpdate
                    ? 'border-warning/35 bg-warning-soft text-warning-soft-foreground'
                    : 'border-border bg-surface-secondary text-muted'
              )}
            >
              {getUpdateStatusLabel(status)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" className="h-9 min-w-32" onPress={onCheck} isDisabled={isBusy} isPending={busy === 'check'}>
              {({ isPending }) => (
                <span className="inline-flex items-center gap-1.5">
                  {isPending ? <Spinner color="current" size="sm" /> : <RiRefreshLine size={16} />}
                  检查更新
                </span>
              )}
            </Button>
            {hasUpdate && (
              <Button size="sm" variant="primary" className="h-9" onPress={onOpenReleasePage} isDisabled={isBusy} isPending={busy === 'release'}>
                {({ isPending }) => (
                  <span className="inline-flex items-center gap-1.5">
                    {isPending ? <Spinner color="current" size="sm" /> : <RiDownloadLine size={16} />}
                    打开下载页
                  </span>
                )}
              </Button>
            )}
          </div>
        </div>

        {message && <div className={cn('text-xs leading-5', isError ? 'text-danger-soft-foreground' : 'text-muted')}>{message}</div>}
      </div>
    </div>
  )
}

function LocalFoldersCard({
  appDataPath,
  agents,
  onOpenAppData,
  onOpenAgent
}: {
  appDataPath: string
  agents: Array<{ id: AgentId; label: string; skillsPath: string }>
  onOpenAppData: () => void
  onOpenAgent: (agentId: AgentId) => void
}): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-surface">
      <div className="flex items-start gap-2.5">
        <RiFolderLine size={20} className="mt-0.5 shrink-0 text-accent" />
        <div>
          <div className="text-base font-semibold leading-6 text-foreground">本地目录</div>
          <div className="text-xs text-muted">应用数据与 Agent Skills 目录</div>
        </div>
      </div>

      <div className="mt-4 overflow-hidden">
        <LocalFolderRow label="应用数据目录" value={appDataPath} tag="app-data" onOpen={onOpenAppData} />
        {agents.map((agent) => (
          <LocalFolderRow
            key={agent.id}
            label={`${agent.label} Skills 目录`}
            value={agent.skillsPath}
            tag="agent"
            onOpen={() => onOpenAgent(agent.id)}
          />
        ))}
      </div>
    </div>
  )
}

function LocalFolderRow({ label, value, tag, onOpen }: { label: string; value: string; tag: string; onOpen: () => void }): React.JSX.Element {
  return (
    <div className="grid min-w-0 gap-2.5 border-b border-border py-2.5 last:border-b-0 md:grid-cols-[minmax(0,1fr)_76px_136px] md:items-center">
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="mt-0.5 min-w-0 truncate font-mono text-xs text-muted" title={value}>
          {value}
        </div>
      </div>
      <span className="inline-flex h-6 w-fit items-center rounded-md border border-border bg-surface-secondary px-2.5 text-xs font-medium text-muted md:justify-self-end">
        {tag}
      </span>
      <Button variant="secondary" className="h-9 justify-self-start md:justify-self-end" onPress={onOpen}>
        <span className="inline-flex items-center gap-2">
          <RiFolderOpenLine size={17} />
          打开文件夹
        </span>
      </Button>
    </div>
  )
}

function IconActionButton({
  label,
  tooltip,
  icon,
  tone = 'default',
  disabled,
  onClick
}: {
  label: string
  tooltip: string
  icon: 'copy' | 'delete' | 'spinner'
  tone?: 'default' | 'danger'
  disabled: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <Tooltip>
      <Tooltip.Trigger className="inline-flex">
        <button
          type="button"
          aria-label={label}
          className={cn(
            'inline-flex size-7 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-50',
            tone === 'danger'
              ? 'border-danger/35 bg-danger-soft text-danger-soft-foreground hover:border-danger/60'
              : 'border-border bg-surface text-muted hover:bg-surface-hover hover:text-foreground'
          )}
          disabled={disabled}
          onClick={onClick}
        >
          {icon === 'spinner' ? (
            <Spinner color="current" size="sm" />
          ) : icon === 'copy' ? (
            <RiFileCopyLine size={15} />
          ) : (
            <RiDeleteBinLine size={15} />
          )}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content>{tooltip}</Tooltip.Content>
    </Tooltip>
  )
}

function getUpdateStatusLabel(status: AppUpdateStatus | null): string {
  switch (status?.status) {
    case 'checking':
      return '检查中'
    case 'available':
      return '可更新'
    case 'not-available':
      return '已是最新'
    case 'error':
      return '检查失败'
    default:
      return '未检查'
  }
}

function getUpdateMessage(status: AppUpdateStatus | null): string {
  switch (status?.status) {
    case 'available':
      return status.message ?? '发现新版本，请前往 Releases 页面下载对应系统的安装包手动安装。'
    case 'error':
      return status.message ?? ''
    default:
      return ''
  }
}
