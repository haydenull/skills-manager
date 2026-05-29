import { Link, Outlet, createRootRoute } from '@tanstack/react-router'
import { useTheme } from '@heroui/react'
import { RiAddCircleLine, RiDashboardLine, RiSettings3Line } from '@remixicon/react'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: RiDashboardLine },
  { to: '/install', label: '安装新 Skill', icon: RiAddCircleLine },
  { to: '/settings', label: '设置', icon: RiSettings3Line }
]

export const Route = createRootRoute({
  component: RootLayout
})

function RootLayout(): React.JSX.Element {
  useTheme('dark')

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-5 px-6 py-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-surface px-5 py-4 shadow-surface">
          <div>
            <h1 className="text-2xl font-semibold">Skills Manager</h1>
            <p className="mt-1 text-sm text-muted">统一管理 Claude Code 与 Codex 的全局技能。</p>
          </div>
          <nav className="flex flex-wrap gap-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted transition-colors hover:border-border-secondary hover:bg-surface-hover"
                  activeProps={{
                    className:
                      'inline-flex items-center gap-2 rounded-md border border-accent/40 bg-accent-soft px-3 py-2 text-sm text-accent-soft-foreground'
                  }}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </header>
        <Outlet />
      </div>
    </main>
  )
}
