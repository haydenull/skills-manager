export type AgentId = 'claude-code' | 'codex'
export type SettingsFolderTarget = 'app-data' | 'agent-skills'

export type AppInfo = {
  version: string
}

export type AppUpdateInfo = {
  version: string
  releaseName?: string
  releaseDate?: string
}

export type AppUpdateStatus = {
  status: 'idle' | 'checking' | 'not-available' | 'available' | 'downloading' | 'downloaded' | 'error'
  currentVersion: string
  update?: AppUpdateInfo
  downloadProgress?: {
    percent: number
    transferred: number
    total: number
    bytesPerSecond: number
  }
  message?: string
}

export type InstalledSkill = {
  name: string
  description: string
  storagePath: string
  agents: AgentId[]
  source?: string
  provider?: 'github' | 'gitlab' | 'local'
  installedAt?: string
  debugPath?: string
}

export type SkillUpdateStatus = {
  name: string
  hasUpdate: boolean
  error?: string
}

export type SkillPreview = {
  name: string
  description: string
  skillPath: string
  folderSha: string | null
  installState?: 'installed' | 'conflict'
  installMessage?: string
}

export type InstallRequest = {
  source: string
  skills: SkillPreview[]
  agents: AgentId[]
  fullDepth?: boolean
}

export type AgentUpdateRequest = {
  names: string[]
  agents: AgentId[]
}

export type RemoveRequest = {
  names: string[]
  agents: AgentId[]
}

export type SettingsInfo = {
  appDataPath: string
  gitlabTokenHosts: string[]
  agents: Array<{
    id: AgentId
    label: string
    skillsPath: string
  }>
}

export type OperationResult = {
  ok: boolean
  logs: string[]
}
