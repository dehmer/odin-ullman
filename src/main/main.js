/* eslint-disable dot-notation */
import path from 'path'
import url from 'url'
import { app, BrowserWindow, ipcMain } from 'electron'


app.allowRendererProcessReuse = true
process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

const createWindow = async () => {

  const window = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  const devServer = process.argv.indexOf('--noDevServer') === -1
  const hotDeployment = process.defaultApp ||
    /[\\/]electron-prebuilt[\\/]/.test(process.execPath) ||
    /[\\/]electron[\\/]/.test(process.execPath)
  const windowUrl = (hotDeployment && devServer)
    ? url.format({ protocol: 'http:', host: 'localhost:8080', pathname: 'index.html', slashes: true })
    : url.format({ protocol: 'file:', pathname: path.join(app.getAppPath(), 'dist', 'index.html'), slashes: true })

  await window.loadURL(windowUrl)
  window.show()

  window.on('close', () => {
    console.log('[main] application is going down.')
    window.webContents.send('app-close')
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
