import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { InstallRequest, RemoveRequest } from '../shared/skills-types'

// Custom APIs for renderer
const api = {
  skills: {
    listGlobal: () => ipcRenderer.invoke('skills:list-global'),
    previewGitHubSource: (source: string) =>
      ipcRenderer.invoke('skills:preview-github-source', source),
    install: (request: InstallRequest) => ipcRenderer.invoke('skills:install', request),
    update: (names: string[]) => ipcRenderer.invoke('skills:update', names),
    remove: (request: RemoveRequest) => ipcRenderer.invoke('skills:remove', request)
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
