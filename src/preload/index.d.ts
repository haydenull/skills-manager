import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  InstallRequest,
  InstalledSkill,
  OperationResult,
  RemoveRequest,
  SkillPreview
} from '../shared/skills-types'

type SkillsApi = {
  listGlobal: () => Promise<InstalledSkill[]>
  previewGitHubSource: (source: string) => Promise<SkillPreview[]>
  install: (request: InstallRequest) => Promise<OperationResult>
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
