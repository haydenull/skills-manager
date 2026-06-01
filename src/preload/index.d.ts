import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  AgentUpdateRequest,
  InstallRequest,
  InstalledSkill,
  OperationResult,
  RemoveRequest,
  SettingsInfo,
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
  openStorageFolder: (name: string) => Promise<OperationResult>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      skills: SkillsApi
    }
  }
}
