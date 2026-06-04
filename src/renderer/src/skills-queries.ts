import { queryOptions } from '@tanstack/react-query'
import type { InstalledSkill, SettingsInfo, SkillUpdateStatus } from '../../shared/skills-types'

export const skillsQueryKeys = {
  installed: ['skills', 'installed'] as const,
  updatesRoot: ['skills', 'updates'] as const
}

export const skillsQueryOptions = {
  installed: () =>
    queryOptions({
      queryKey: skillsQueryKeys.installed,
      queryFn: listInstalledSkills
    }),
  updates: (names: string[]) =>
    queryOptions({
      queryKey: ['skills', 'updates', names] as const,
      queryFn: () => checkSkillUpdates(names)
    }),
  settingsInfo: () =>
    queryOptions({
      queryKey: ['settings', 'info'] as const,
      queryFn: getSettingsInfo
    })
}

export function listInstalledSkills(): Promise<InstalledSkill[]> {
  return window.api.skills.listGlobal()
}

export function checkSkillUpdates(names: string[]): Promise<SkillUpdateStatus[]> {
  return window.api.skills.checkUpdates(names)
}

export function getSettingsInfo(): Promise<SettingsInfo> {
  return window.api.skills.getSettingsInfo()
}
