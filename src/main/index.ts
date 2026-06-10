import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { mkdirSync } from 'fs'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater, type UpdateInfo } from 'electron-updater'
import icon from '../../resources/icon.png?asset'
import { SkillsService } from './skills-service'
import type { AppUpdateInfo, AppUpdateStatus, OperationResult } from '../shared/skills-types'

if (process.env.SKILLS_MANAGER_LOCAL_DEBUG === '1') {
  const userDataPath = join(process.cwd(), '.debug', 'userData')
  mkdirSync(userDataPath, { recursive: true })
  app.setPath('userData', userDataPath)
}

const skillsService = new SkillsService()
autoUpdater.autoDownload = false

let appUpdateStatus: AppUpdateStatus = {
  status: 'idle',
  currentVersion: app.getVersion()
}

function toAppUpdateInfo(info: UpdateInfo): AppUpdateInfo {
  return {
    version: info.version,
    releaseName: info.releaseName ?? undefined,
    releaseDate: info.releaseDate
  }
}

function setAppUpdateStatus(status: AppUpdateStatus): AppUpdateStatus {
  appUpdateStatus = status
  return appUpdateStatus
}

function createDevUpdateStatus(): AppUpdateStatus {
  return {
    status: 'error',
    currentVersion: app.getVersion(),
    message: '开发环境不支持检查更新'
  }
}

autoUpdater.on('checking-for-update', () => {
  setAppUpdateStatus({
    status: 'checking',
    currentVersion: app.getVersion()
  })
})

autoUpdater.on('update-available', (info) => {
  setAppUpdateStatus({
    status: 'available',
    currentVersion: app.getVersion(),
    update: toAppUpdateInfo(info)
  })
})

autoUpdater.on('update-not-available', () => {
  setAppUpdateStatus({
    status: 'not-available',
    currentVersion: app.getVersion(),
    message: '当前已是最新版本'
  })
})

autoUpdater.on('update-downloaded', (info) => {
  setAppUpdateStatus({
    status: 'downloaded',
    currentVersion: app.getVersion(),
    update: toAppUpdateInfo(info),
    message: '更新已下载，重启后安装'
  })
})

autoUpdater.on('error', (error) => {
  setAppUpdateStatus({
    status: 'error',
    currentVersion: app.getVersion(),
    update: appUpdateStatus.update,
    message: error.message
  })
})

async function checkForAppUpdates(): Promise<AppUpdateStatus> {
  if (is.dev) return createDevUpdateStatus()

  setAppUpdateStatus({
    status: 'checking',
    currentVersion: app.getVersion()
  })

  try {
    await autoUpdater.checkForUpdates()
    return appUpdateStatus
  } catch (error) {
    return setAppUpdateStatus({
      status: 'error',
      currentVersion: app.getVersion(),
      message: error instanceof Error ? error.message : String(error)
    })
  }
}

async function downloadAppUpdate(): Promise<AppUpdateStatus> {
  if (is.dev) return createDevUpdateStatus()
  if (appUpdateStatus.status !== 'available') {
    return setAppUpdateStatus({
      status: 'error',
      currentVersion: app.getVersion(),
      update: appUpdateStatus.update,
      message: '没有可下载的更新'
    })
  }

  setAppUpdateStatus({
    status: 'downloading',
    currentVersion: app.getVersion(),
    update: appUpdateStatus.update
  })

  try {
    await autoUpdater.downloadUpdate()
    return setAppUpdateStatus({
      status: 'downloaded',
      currentVersion: app.getVersion(),
      update: appUpdateStatus.update,
      message: '更新已下载，重启后安装'
    })
  } catch (error) {
    return setAppUpdateStatus({
      status: 'error',
      currentVersion: app.getVersion(),
      update: appUpdateStatus.update,
      message: error instanceof Error ? error.message : String(error)
    })
  }
}

function installAppUpdate(): OperationResult {
  if (is.dev) return { ok: false, logs: ['开发环境不支持安装更新'] }
  if (appUpdateStatus.status !== 'downloaded') return { ok: false, logs: ['没有已下载的更新'] }

  try {
    autoUpdater.quitAndInstall()
    return { ok: true, logs: ['正在重启安装更新'] }
  } catch (error) {
    return { ok: false, logs: [error instanceof Error ? error.message : String(error)] }
  }
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1024,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('skills:list-global', () => skillsService.listGlobal())
  ipcMain.handle('skills:get-settings-info', () => skillsService.getSettingsInfo())
  ipcMain.handle('skills:preview-source', (_event, source: string, fullDepth?: boolean) => skillsService.previewSource(source, fullDepth))
  ipcMain.handle('skills:install', (_event, request) => skillsService.install(request))
  ipcMain.handle('skills:add-agents', (_event, request) => skillsService.addAgents(request))
  ipcMain.handle('skills:check-updates', (_event, names: string[]) => skillsService.checkUpdates(names))
  ipcMain.handle('skills:update', (_event, names: string[]) => skillsService.update(names))
  ipcMain.handle('skills:remove', (_event, request) => skillsService.remove(request))
  ipcMain.handle('skills:start-debug', (_event, name: string) => skillsService.startDebug(name))
  ipcMain.handle('skills:stop-debug', (_event, name: string) => skillsService.stopDebug(name))
  ipcMain.handle('skills:open-storage-folder', (_event, name: string) => skillsService.openStorageFolder(name))
  ipcMain.handle('skills:open-settings-folder', (_event, target, agentId) => skillsService.openSettingsFolder(target, agentId))
  ipcMain.handle('app:get-info', () => ({ version: app.getVersion() }))
  ipcMain.handle('app:check-for-updates', () => checkForAppUpdates())
  ipcMain.handle('app:download-update', () => downloadAppUpdate())
  ipcMain.handle('app:install-update', () => installAppUpdate())

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
