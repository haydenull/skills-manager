import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { AgentId, AgentUpdateRequest, AppUpdateStatus, InstallRequest, RemoveRequest, SettingsFolderTarget } from '../shared/skills-types'

// Custom APIs for renderer
const api = {
  app: {
    getInfo: () => ipcRenderer.invoke('app:get-info'),
    checkForUpdates: () => ipcRenderer.invoke('app:check-for-updates'),
    openReleasePage: () => ipcRenderer.invoke('app:open-release-page'),
    onUpdateStatus: (callback: (status: AppUpdateStatus) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, status: AppUpdateStatus): void => callback(status)
      ipcRenderer.on('app:update-status', listener)
      return () => ipcRenderer.removeListener('app:update-status', listener)
    }
  },
  skills: {
    listGlobal: () => ipcRenderer.invoke('skills:list-global'),
    getSettingsInfo: () => ipcRenderer.invoke('skills:get-settings-info'),
    previewSource: (source: string, fullDepth?: boolean) => ipcRenderer.invoke('skills:preview-source', source, fullDepth),
    install: (request: InstallRequest) => ipcRenderer.invoke('skills:install', request),
    addAgents: (request: AgentUpdateRequest) => ipcRenderer.invoke('skills:add-agents', request),
    checkUpdates: (names: string[]) => ipcRenderer.invoke('skills:check-updates', names),
    update: (names: string[]) => ipcRenderer.invoke('skills:update', names),
    remove: (request: RemoveRequest) => ipcRenderer.invoke('skills:remove', request),
    saveGitLabToken: (host: string, token: string) => ipcRenderer.invoke('skills:save-gitlab-token', host, token),
    getGitLabToken: (host: string) => ipcRenderer.invoke('skills:get-gitlab-token', host),
    deleteGitLabToken: (host: string) => ipcRenderer.invoke('skills:delete-gitlab-token', host),
    startDebug: (name: string) => ipcRenderer.invoke('skills:start-debug', name),
    stopDebug: (name: string) => ipcRenderer.invoke('skills:stop-debug', name),
    openStorageFolder: (name: string) => ipcRenderer.invoke('skills:open-storage-folder', name),
    openSettingsFolder: (target: SettingsFolderTarget, agentId?: AgentId) => ipcRenderer.invoke('skills:open-settings-folder', target, agentId)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
