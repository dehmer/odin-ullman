import path from 'path'
import url from 'url'
import { app, BrowserWindow } from 'electron'
import { open } from './master'

app.allowRendererProcessReuse = true
process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'


app.whenReady().then(open)

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
