export type AgentId = 'claude-code' | 'codex'

export type InstalledSkill = {
  name: string
  storagePath: string
  agents: AgentId[]
  source?: string
  updatedAt?: string
}

export type SkillPreview = {
  name: string
  description: string
  skillPath: string
  folderSha: string | null
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
