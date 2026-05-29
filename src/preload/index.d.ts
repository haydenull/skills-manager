import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  AgentUpdateRequest,
  InstallRequest,
  InstalledSkill,
  OperationResult,
  RemoveRequest,
  SettingsInfo,
  SkillPreview
} from '../shared/skills-types'

type SkillsApi = {
  listGlobal: () => Promise<InstalledSkill[]>
  getSettingsInfo: () => Promise<SettingsInfo>
  previewGitHubSource: (source: string) => Promise<SkillPreview[]>
  install: (request: InstallRequest) => Promise<OperationResult>
  addAgents: (request: AgentUpdateRequest) => Promise<OperationResult>
  update: (names: string[]) => Promise<OperationResult>
  remove: (request: RemoveRequest) => Promise<OperationResult>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      skills: SkillsApi
    }
  }
}
