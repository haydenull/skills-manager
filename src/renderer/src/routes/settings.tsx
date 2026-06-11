import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Button, Input, Spinner, useTheme } from '@heroui/react'
import {
  RiDeleteBinLine,
  RiDownloadLine,
  RiFolderLine,
  RiRefreshLine,
  RiRestartLine,
  RiMoonLine,
  RiSaveLine,
  RiSettings3Line,
  RiSunLine
} from '@remixicon/react'
import { useEffect, useState } from 'react'
import type { AgentId, AppInfo, AppUpdateStatus, SettingsFolderTarget } from '../../../shared/skills-types'
import { skillsQueryOptions } from '../skills-queries'

export const Route = createFileRoute('/settings')({
  component: SettingsPage
})

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
  const isDark = currentTheme === 'dark'

  useEffect(() => {
    window.api.app.getInfo().then(setAppInfo)
  }, [])

  async function openFolder(target: SettingsFolderTarget, agentId?: AgentId): Promise<void> {
    setOpenError('')
    const result = await window.api.skills.openSettingsFolder(target, agentId)
    if (!result.ok) setOpenError(result.logs.join('\n'))
  }

  async function checkUpdates(): Promise<void> {
    setUpdateBusy('check')
    setUpdateStatus(await window.api.app.checkForUpdates())
    setUpdateBusy('')
  }

  async function downloadUpdate(): Promise<void> {
    setUpdateBusy('download')
    setUpdateStatus(await window.api.app.downloadUpdate())
    setUpdateBusy('')
  }

  async function installUpdate(): Promise<void> {
    setUpdateBusy('install')
    const result = await window.api.app.installUpdate()
    if (!result.ok) {
      setUpdateStatus({
        status: 'error',
        currentVersion: appInfo?.version ?? '',
        update: updateStatus?.update,
        message: result.logs.join('\n')
      })
      setUpdateBusy('')
    }
  }

  async function saveGitLabToken(): Promise<void> {
    setGitlabBusy('save')
    setGitlabMessage('')
    const result = await window.api.skills.saveGitLabToken(gitlabHost, gitlabToken)
    setGitlabMessage(result.logs.join('\n'))
    if (result.ok) {
      setGitlabHost('')
      setGitlabToken('')
      await settingsQuery.refetch()
    }
    setGitlabBusy('')
  }

  async function deleteGitLabToken(host: string): Promise<void> {
    setGitlabBusy(host)
    setGitlabMessage('')
    const result = await window.api.skills.deleteGitLabToken(host)
    setGitlabMessage(result.logs.join('\n'))
    if (result.ok) await settingsQuery.refetch()
    setGitlabBusy('')
  }

  if (!settings) {
    return (
      <section className="flex flex-1 items-center justify-center rounded-lg border border-border bg-surface p-8 text-muted">
        <Spinner size="sm" />
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-5 shadow-surface">
      <div className="flex items-center gap-2">
        <RiSettings3Line size={18} className="text-accent" />
        <h2 className="text-base font-medium">设置</h2>
      </div>
      <div className="mt-5 grid gap-4">
        <div className="rounded-lg border border-border bg-surface-secondary p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-foreground">外观</div>
              <div className="mt-1 text-xs text-muted">当前为{isDark ? '深色' : '浅色'}模式</div>
            </div>
            <Button variant="secondary" onPress={() => setTheme(isDark ? 'light' : 'dark')}>
              <span className="inline-flex items-center gap-1.5">
                {isDark ? <RiSunLine size={16} /> : <RiMoonLine size={16} />}
                切换到{isDark ? '浅色' : '深色'}
              </span>
            </Button>
          </div>
        </div>
        <UpdateRow
          version={appInfo?.version}
          status={updateStatus}
          busy={updateBusy}
          onCheck={() => void checkUpdates()}
          onDownload={() => void downloadUpdate()}
          onInstall={() => void installUpdate()}
        />
        <GitLabTokenRow
          hosts={settings.gitlabTokenHosts}
          host={gitlabHost}
          token={gitlabToken}
          busy={gitlabBusy}
          message={gitlabMessage}
          onHostChange={setGitlabHost}
          onTokenChange={setGitlabToken}
          onSave={() => void saveGitLabToken()}
          onDelete={(host) => void deleteGitLabToken(host)}
        />
        <PathRow label="应用数据目录" value={settings.appDataPath} onOpen={() => void openFolder('app-data')} />
        {settings.agents.map((agent) => (
          <PathRow
            key={agent.id}
            label={`${agent.label} Skills 目录`}
            value={agent.skillsPath}
            onOpen={() => void openFolder('agent-skills', agent.id)}
          />
        ))}
        {openError && <div className="rounded-lg border border-danger-soft bg-danger-soft p-3 text-xs text-danger-soft-foreground">{openError}</div>}
      </div>
    </section>
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
  onDelete: (host: string) => void
}): React.JSX.Element {
  const isSaving = busy === 'save'

  return (
    <div className="rounded-lg border border-border bg-surface-secondary p-4">
      <div className="text-sm font-medium text-foreground">GitLab Token</div>
      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <Input aria-label="GitLab Host" placeholder="gitlab.corp.youdao.com" value={host} onChange={(event) => onHostChange(event.target.value)} />
        <Input
          aria-label="GitLab Token"
          type="password"
          placeholder="Personal access token"
          value={token}
          onChange={(event) => onTokenChange(event.target.value)}
        />
        <Button size="sm" variant="primary" className="self-end" onPress={onSave} isPending={isSaving} isDisabled={busy !== ''}>
          {({ isPending }) => (
            <span className="inline-flex items-center gap-1.5">
              {isPending ? <Spinner color="current" size="sm" /> : <RiSaveLine size={16} />}
              保存
            </span>
          )}
        </Button>
      </div>
      {hosts.length > 0 && (
        <div className="mt-3 grid gap-2">
          {hosts.map((configuredHost) => (
            <div
              key={configuredHost}
              className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2"
            >
              <div>
                <div className="break-all text-xs font-medium text-foreground">{configuredHost}</div>
                <div className="mt-0.5 text-xs text-muted">已配置</div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onPress={() => onDelete(configuredHost)}
                isPending={busy === configuredHost}
                isDisabled={busy !== ''}
              >
                {({ isPending }) => (
                  <span className="inline-flex items-center gap-1.5">
                    {isPending ? <Spinner color="current" size="sm" /> : <RiDeleteBinLine size={16} />}
                    删除
                  </span>
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
      {message && <div className="mt-3 rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted">{message}</div>}
    </div>
  )
}

function UpdateRow({
  version,
  status,
  busy,
  onCheck,
  onDownload,
  onInstall
}: {
  version?: string
  status: AppUpdateStatus | null
  busy: string
  onCheck: () => void
  onDownload: () => void
  onInstall: () => void
}): React.JSX.Element {
  const isBusy = busy !== ''
  const hasUpdate = status?.status === 'available'
  const isDownloaded = status?.status === 'downloaded'
  const isError = status?.status === 'error'
  const message = getUpdateMessage(status)

  return (
    <div className="rounded-lg border border-border bg-surface-secondary p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-foreground">关于与更新</div>
          <div className="mt-1 text-xs text-muted">当前版本 v{version ?? '-'}</div>
          {status?.update && <div className="mt-1 text-xs text-muted">最新版本 v{status.update.version}</div>}
          {message && <div className={`mt-2 text-xs ${isError ? 'text-danger-soft-foreground' : 'text-muted'}`}>{message}</div>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onPress={onCheck} isDisabled={isBusy} isPending={busy === 'check'}>
            {({ isPending }) => (
              <span className="inline-flex items-center gap-1.5">
                {isPending ? <Spinner color="current" size="sm" /> : <RiRefreshLine size={16} />}
                检查更新
              </span>
            )}
          </Button>
          {hasUpdate && (
            <Button size="sm" variant="primary" onPress={onDownload} isDisabled={isBusy} isPending={busy === 'download'}>
              {({ isPending }) => (
                <span className="inline-flex items-center gap-1.5">
                  {isPending ? <Spinner color="current" size="sm" /> : <RiDownloadLine size={16} />}
                  下载更新
                </span>
              )}
            </Button>
          )}
          {isDownloaded && (
            <Button size="sm" variant="primary" onPress={onInstall} isDisabled={isBusy} isPending={busy === 'install'}>
              {({ isPending }) => (
                <span className="inline-flex items-center gap-1.5">
                  {isPending ? <Spinner color="current" size="sm" /> : <RiRestartLine size={16} />}
                  重启安装
                </span>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function getUpdateMessage(status: AppUpdateStatus | null): string {
  if (!status) return ''
  if (status.message) return status.message
  if (status.status === 'checking') return '正在检查更新...'
  if (status.status === 'available') return '发现新版本，可以下载更新'
  if (status.status === 'downloading') return '正在下载更新...'
  return ''
}

function PathRow({ label, value, onOpen }: { label: string; value: string; onOpen: () => void }): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-surface-secondary p-4">
      <div className="text-sm font-medium text-foreground">{label}</div>
      <button
        type="button"
        className="mt-1 flex min-w-0 items-center gap-1.5 rounded-md text-xs text-muted transition hover:text-foreground"
        aria-label={`打开${label}`}
        onClick={onOpen}
      >
        <RiFolderLine size={14} className="shrink-0" />
        <span className="min-w-0 break-all text-left">{value}</span>
      </button>
    </div>
  )
}
