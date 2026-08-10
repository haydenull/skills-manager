import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  AgentId,
  AgentUpdateRequest,
  AppInfo,
  AppUpdateStatus,
  InstallRequest,
  InstalledSkill,
  RemoveRequest,
  SettingsInfo,
  SettingsFolderTarget,
  SkillPreview,
  SkillUpdateStatus
} from '../shared/skills-types'

type AppApi = {
  getInfo: () => Promise<AppInfo>
  checkForUpdates: () => Promise<AppUpdateStatus>
  openReleasePage: () => Promise<void>
  onUpdateStatus: (callback: (status: AppUpdateStatus) => void) => () => void
}

type SkillsApi = {
  listGlobal: () => Promise<InstalledSkill[]>
  getSettingsInfo: () => Promise<SettingsInfo>
  previewSource: (source: string, fullDepth?: boolean) => Promise<SkillPreview[]>
  install: (request: InstallRequest) => Promise<OperationResult>
  addAgents: (request: AgentUpdateRequest) => Promise<OperationResult>
  checkUpdates: (names: string[]) => Promise<SkillUpdateStatus[]>
  update: (names: string[]) => Promise<OperationResult>
  remove: (request: RemoveRequest) => Promise<OperationResult>
  saveGitLabToken: (host: string, token: string) => Promise<OperationResult>
  getGitLabToken: (host: string) => Promise<string>
  deleteGitLabToken: (host: string) => Promise<OperationResult>
  startDebug: (name: string) => Promise<OperationResult>
  stopDebug: (name: string) => Promise<OperationResult>
  openStorageFolder: (name: string) => Promise<OperationResult>
  openSourceFolder: (name: string) => Promise<OperationResult>
  openSettingsFolder: (target: SettingsFolderTarget, agentId?: AgentId) => Promise<OperationResult>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      app: AppApi
      skills: SkillsApi
    }
  }
}
