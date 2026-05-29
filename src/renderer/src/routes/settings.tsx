import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Button, Spinner, useTheme } from '@heroui/react'
import { RiFolderLine, RiMoonLine, RiSettings3Line, RiSunLine } from '@remixicon/react'
import type { SettingsInfo } from '../../../shared/skills-types'

export const Route = createFileRoute('/settings')({
  component: SettingsPage
})

function SettingsPage(): React.JSX.Element {
  const [settings, setSettings] = useState<SettingsInfo | null>(null)
  const { resolvedTheme, setTheme, theme } = useTheme('dark')
  const currentTheme = resolvedTheme ?? theme
  const isDark = currentTheme === 'dark'

  useEffect(() => {
    async function loadSettings(): Promise<void> {
      setSettings(await window.api.skills.getSettingsInfo())
    }

    void loadSettings()
  }, [])

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
        <PathRow label="应用数据目录" value={settings.appDataPath} />
        {settings.agents.map((agent) => (
          <PathRow key={agent.id} label={`${agent.label} Skills 目录`} value={agent.skillsPath} />
        ))}
      </div>
    </section>
  )
}

function PathRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-surface-secondary p-4">
      <div className="text-sm font-medium text-foreground">{label}</div>
      <div className="mt-2 flex items-center gap-2 font-mono text-xs text-muted">
        <RiFolderLine size={14} className="shrink-0" />
        <span className="break-all">{value}</span>
      </div>
    </div>
  )
}
