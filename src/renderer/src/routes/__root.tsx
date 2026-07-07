import { Link, Outlet, createRootRoute, useLocation } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from '@heroui/react'
import { useState } from 'react'
import { RiAddCircleLine, RiBookOpenLine, RiFolderLine, RiGithubLine, RiGitlabLine, RiSettings3Line, RiStackLine } from '@remixicon/react'
import appLogo from '../assets/app-logo.svg'
import { HomeSidebarContext, type SourceFilter } from '../home-sidebar-context'
import { cn } from '../lib/cn'
import { skillsQueryOptions } from '../skills-queries'
import type { InstalledSkill } from '../../../shared/skills-types'

const NAV_ITEMS = [
  { to: '/', label: 'Skill Library', icon: RiBookOpenLine },
  { to: '/install', label: '安装新 Skill', icon: RiAddCircleLine },
  { to: '/settings', label: '设置', icon: RiSettings3Line }
]

const SOURCE_FILTERS = [
  { id: 'all', label: '全部', icon: RiStackLine },
  { id: 'github', label: 'GitHub', icon: RiGithubLine },
  { id: 'gitlab', label: 'GitLab', icon: RiGitlabLine },
  { id: 'local', label: '本地', icon: RiFolderLine }
] satisfies Array<{ id: SourceFilter; label: string; icon: typeof RiStackLine }>

export const Route = createRootRoute({
  component: RootLayout
})

function RootLayout(): React.JSX.Element {
  useTheme('dark')
  const location = useLocation()
  const { data: installedSkills = [] } = useQuery(skillsQueryOptions.installed())
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const isHome = location.pathname === '/'
  const sourceCounts = getSourceCounts(installedSkills)

  return (
    <HomeSidebarContext.Provider value={{ sourceFilter, setSourceFilter }}>
      <main className="h-screen min-h-0 overflow-hidden bg-background text-foreground">
        <div className="grid h-full min-h-0 grid-cols-[232px_minmax(0,1fr)] overflow-hidden">
          <aside className="flex h-full min-h-0 flex-col overflow-hidden border-r border-border bg-surface/90 px-3 py-4">
            <div className="flex items-center gap-3 px-2">
              <img src={appLogo} alt="" className="size-9 rounded-lg shadow-surface" />
              <h1 className="text-base font-semibold tracking-normal">Skills Manager</h1>
            </div>

            <nav className="mt-7 grid gap-1.5">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                    activeProps={{
                      className:
                        'flex h-10 items-center gap-3 rounded-lg bg-accent-soft px-3 text-sm font-semibold text-accent-soft-foreground shadow-surface'
                    }}
                  >
                    <Icon size={20} />
                    {item.label}
                  </Link>
                )
              })}
            </nav>

            {isHome && (
              <div className="mt-7 border-t border-border pt-4">
                <div className="px-2 text-xs font-medium text-foreground">来源筛选</div>
                <div className="mt-2 grid gap-1">
                  {SOURCE_FILTERS.map((item) => {
                    const Icon = item.icon
                    const isActive = sourceFilter === item.id

                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={cn(
                          'flex h-9 items-center justify-between rounded-md px-3 text-sm transition-colors',
                          isActive
                            ? 'bg-accent-soft text-accent-soft-foreground shadow-surface'
                            : 'text-muted hover:bg-surface-hover hover:text-foreground'
                        )}
                        onClick={() => setSourceFilter(item.id)}
                      >
                        <span className="flex items-center gap-2.5">
                          <Icon size={18} />
                          <span className="font-medium">{item.label}</span>
                        </span>
                        <span
                          className={cn(
                            'min-w-5 rounded-full px-1.5 py-0.5 text-center text-xs',
                            isActive ? 'bg-accent text-accent-foreground' : 'text-muted'
                          )}
                        >
                          {sourceCounts[item.id]}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="mt-auto border-t border-border px-2 pt-4 text-sm text-muted">
              <div className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-success" />
                <span>共 {installedSkills.length} 个 Skill</span>
              </div>
            </div>
          </aside>

          <div className={cn('h-full min-h-0 min-w-0', isHome ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden')}>
            <Outlet />
          </div>
        </div>
      </main>
    </HomeSidebarContext.Provider>
  )
}

function getSourceCounts(skills: InstalledSkill[]): Record<SourceFilter, number> {
  return {
    all: skills.length,
    github: skills.filter((skill) => skill.provider === 'github').length,
    gitlab: skills.filter((skill) => skill.provider === 'gitlab').length,
    local: skills.filter((skill) => skill.provider === 'local').length
  }
}
