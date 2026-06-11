import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  AgentId,
  AgentUpdateRequest,
  AppInfo,
  AppUpdateStatus,
  InstallRequest,
  InstalledSkill,
  OperationResult,
  RemoveRequest,
  SettingsInfo,
  SettingsFolderTarget,
  SkillPreview,
  SkillUpdateStatus
} from '../shared/skills-types'

type AppApi = {
  getInfo: () => Promise<AppInfo>
  checkForUpdates: () => Promise<AppUpdateStatus>
  downloadUpdate: () => Promise<AppUpdateStatus>
  installUpdate: () => Promise<OperationResult>
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
  deleteGitLabToken: (host: string) => Promise<OperationResult>
  startDebug: (name: string) => Promise<OperationResult>
  stopDebug: (name: string) => Promise<OperationResult>
  openStorageFolder: (name: string) => Promise<OperationResult>
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
