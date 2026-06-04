import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Button, Spinner, useTheme } from '@heroui/react'
import { RiFolderLine, RiMoonLine, RiSettings3Line, RiSunLine } from '@remixicon/react'
import { useState } from 'react'
import type { AgentId, SettingsFolderTarget } from '../../../shared/skills-types'
import { skillsQueryOptions } from '../skills-queries'

export const Route = createFileRoute('/settings')({
  component: SettingsPage
})

function SettingsPage(): React.JSX.Element {
  const settingsQuery = useQuery(skillsQueryOptions.settingsInfo())
  const settings = settingsQuery.data
  const { resolvedTheme, setTheme, theme } = useTheme('dark')
  const [openError, setOpenError] = useState('')
  const currentTheme = resolvedTheme ?? theme
  const isDark = currentTheme === 'dark'

  async function openFolder(target: SettingsFolderTarget, agentId?: AgentId): Promise<void> {
    setOpenError('')
    const result = await window.api.skills.openSettingsFolder(target, agentId)
    if (!result.ok) setOpenError(result.logs.join('\n'))
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
