import { Link, Outlet, createRootRoute } from '@tanstack/react-router'
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
  return (
    <main className="min-h-screen bg-[#0b0d12] text-zinc-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-5 px-6 py-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900/80 px-5 py-4">
          <div>
            <h1 className="text-2xl font-semibold">Skills Manager</h1>
            <p className="mt-1 text-sm text-zinc-400">统一管理 Claude Code 与 Codex 的全局技能。</p>
          </div>
          <nav className="flex flex-wrap gap-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="inline-flex items-center gap-2 rounded-md border border-zinc-800 px-3 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-800/60"
                  activeProps={{
                    className: 'inline-flex items-center gap-2 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100'
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
