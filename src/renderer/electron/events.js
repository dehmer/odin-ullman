import { remote } from 'electron'

// REFERENCE: https://www.geeksforgeeks.org/keyboard-events-in-electronjs/
const BrowserWindow = remote.BrowserWindow
const win = BrowserWindow.getFocusedWindow()

win && win.webContents.on('before-input-event', (event, input) => {
  console.log('[electron/events]', input)
})
