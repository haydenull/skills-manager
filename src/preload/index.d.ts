import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  AgentId,
  AgentUpdateRequest,
  InstallRequest,
  InstalledSkill,
  OperationResult,
  RemoveRequest,
  SettingsInfo,
  SettingsFolderTarget,
  SkillPreview,
  SkillUpdateStatus
} from '../shared/skills-types'

type SkillsApi = {
  listGlobal: () => Promise<InstalledSkill[]>
  getSettingsInfo: () => Promise<SettingsInfo>
  previewSource: (source: string, fullDepth?: boolean) => Promise<SkillPreview[]>
  install: (request: InstallRequest) => Promise<OperationResult>
  addAgents: (request: AgentUpdateRequest) => Promise<OperationResult>
  checkUpdates: (names: string[]) => Promise<SkillUpdateStatus[]>
  update: (names: string[]) => Promise<OperationResult>
  remove: (request: RemoveRequest) => Promise<OperationResult>
  startDebug: (name: string) => Promise<OperationResult>
  stopDebug: (name: string) => Promise<OperationResult>
  openStorageFolder: (name: string) => Promise<OperationResult>
  openSettingsFolder: (target: SettingsFolderTarget, agentId?: AgentId) => Promise<OperationResult>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      skills: SkillsApi
    }
  }
}
