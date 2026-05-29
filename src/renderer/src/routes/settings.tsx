import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Spinner } from '@heroui/react'
import { RiFolderLine, RiSettings3Line } from '@remixicon/react'
import type { SettingsInfo } from '../../../shared/skills-types'

export const Route = createFileRoute('/settings')({
  component: SettingsPage
})

function SettingsPage(): React.JSX.Element {
  const [settings, setSettings] = useState<SettingsInfo | null>(null)

  useEffect(() => {
    async function loadSettings(): Promise<void> {
      setSettings(await window.api.skills.getSettingsInfo())
    }

    void loadSettings()
  }, [])

  if (!settings) {
    return (
      <section className="flex flex-1 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/70 p-8 text-zinc-400">
        <Spinner size="sm" />
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-5">
      <div className="flex items-center gap-2">
        <RiSettings3Line size={18} className="text-cyan-300" />
        <h2 className="text-base font-medium">设置</h2>
      </div>
      <div className="mt-5 grid gap-4">
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
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/30 p-4">
      <div className="text-sm font-medium text-zinc-200">{label}</div>
      <div className="mt-2 flex items-center gap-2 font-mono text-xs text-zinc-500">
        <RiFolderLine size={14} className="shrink-0" />
        <span className="break-all">{value}</span>
      </div>
    </div>
  )
}
