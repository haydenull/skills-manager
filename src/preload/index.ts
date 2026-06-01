import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { AgentUpdateRequest, InstallRequest, RemoveRequest } from '../shared/skills-types'

// Custom APIs for renderer
const api = {
  skills: {
    listGlobal: () => ipcRenderer.invoke('skills:list-global'),
    getSettingsInfo: () => ipcRenderer.invoke('skills:get-settings-info'),
    previewSource: (source: string, fullDepth?: boolean) => ipcRenderer.invoke('skills:preview-source', source, fullDepth),
    install: (request: InstallRequest) => ipcRenderer.invoke('skills:install', request),
    addAgents: (request: AgentUpdateRequest) => ipcRenderer.invoke('skills:add-agents', request),
    checkUpdates: (names: string[]) => ipcRenderer.invoke('skills:check-updates', names),
    update: (names: string[]) => ipcRenderer.invoke('skills:update', names),
    remove: (request: RemoveRequest) => ipcRenderer.invoke('skills:remove', request),
    openStorageFolder: (name: string) => ipcRenderer.invoke('skills:open-storage-folder', name)
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
