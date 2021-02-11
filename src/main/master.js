import os from 'os'
import path from 'path'
import url from 'url'
import fs from 'fs'
import { app, BrowserWindow, ipcMain } from 'electron'
import levelup from 'levelup'
import leveldown from 'leveldown'
import encoding from 'encoding-down'
import * as R from 'ramda'
import uuid from 'uuid-random'

const userData = app.getPath('userData')
const databases = path.join(userData, 'databases')
const filename = path.join(databases, 'master')

fs.mkdir(databases, function(err) {
  if (err && err.code !== 'EEXIST') console.error(err)
})

const master = levelup(encoding(leveldown(filename), { valueEncoding: 'json' }))


const readMaster = options => new Promise((resolve, reject) => {
  const xs = []
  master.createReadStream(options)
    .on('data', data => xs.push(data))
    .on('error', reject)
    .once('end', () => resolve(xs))
})

export const value = key => master.get(key).catch(() => null)

const values = async arg => {
  if (Array.isArray(arg)) {
    return arg.reduce(async (accp, id) => {
      const acc = await accp
      acc.push(await value(id))
      return acc
    }, [])
  }
  else {
    const prefix = arg
    const options = prefix
      ? { keys: false, values: true, gte: prefix, lte: prefix + '\xff' }
      : { keys: false, values: true }

    return readMaster(options)
  }
}

const put = item => master.put(item.id, item)
const batch = ops => {
  master.batch(ops)
  // TODO: open/close/delete project
}

ipcMain.handle('ipc.query.master.value', (event, key) => value(key))
ipcMain.handle('ipc.query.master.values', (event, arg) => values(arg))
ipcMain.handle('ipc.command.master.put', (event, item) => put(item))
ipcMain.handle('ipc.command.master.batch', (event, ops) => batch(ops))

ipcMain.handle('ipc.query.project', event => {
  const windows = BrowserWindow.getAllWindows()
  const sender = windows.find(window => window.webContents === event.sender)

  return {
    // NOTE: Cannot find API doc for `browserWindowOptions`.
    projectId: event.sender.browserWindowOptions.projectId,
    userData: app.getPath('userData')
  }
})

ipcMain.on('ipc.command.project.open', async (event, id) => {
  const windows = BrowserWindow.getAllWindows()

  const window = windows.find(window => window.webContents.browserWindowOptions.projectId === id)
  if (window) return window.focus()

  const project = await master.get(id)
  await master.put(id, { ...project, open: true })
  // TODO: notify renderers
  createWindow(project)
})

var quitting = false
app.on('before-quit', () => {
  quitting = true
})

const createWindow = async ({ id }) => {
  const devServer = process.argv.indexOf('--noDevServer') === -1
  const hotDeployment = process.defaultApp ||
    /[\\/]electron-prebuilt[\\/]/.test(process.execPath) ||
    /[\\/]electron[\\/]/.test(process.execPath)

  const windowUrl = (hotDeployment && devServer)
    ? url.format({ protocol: 'http:', host: 'localhost:8080', pathname: 'index.html', slashes: true })
    : url.format({ protocol: 'file:', pathname: path.join(app.getAppPath(), 'dist', 'index.html'), slashes: true })

  const window = new BrowserWindow({
    projectId: id,
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  window.on('close', async () => {
    // don't close project, when quiting
    if (quitting) return

    const project = await master.get(id)
    put({ ...project, open: false })
  })

  await window.loadURL(windowUrl)
  window.show()
}

// /**
//  *
//  */
// const importProjects = async projects => {
//   const USER_HOME = os.homedir()
//   const ODIN_HOME = path.join(USER_HOME, 'ODIN')
//   const PROJECTS = path.join(ODIN_HOME, 'projects')

//   // Only import once:
//   const imports = await values('import:')
//   if (imports.find(x => x.path === USER_HOME)) return
//   await put({ id: `import:${uuid()}`, path: USER_HOME}, { quiet: true })

//   const readLayers = project => new Promise((resolve, reject) => {
//     fs.readdir(path.join(PROJECTS, project, 'layers'), { withFileTypes: true }, (err, files) => {
//       if (err) return reject(err)
//       resolve(files
//         .filter(dirent => dirent.isFile())
//         .filter(dirent => dirent.name.endsWith('.json'))
//         .map(dirent => dirent.name)
//         .map(layer => path.join(PROJECTS, project, 'layers', layer))
//         .map(layer => {
//           const json = JSON.parse(fs.readFileSync(layer, 'utf8'))
//           json.name = path.basename(layer, '.json')
//           return json
//         })
//         .map(R.tap(layer => layer.id = `layer:${uuid()}`))
//         .map(layer => {
//           layer.features = layer.features.map(feature => {
//             delete feature.id
//             delete feature.properties.layerId
//             if (feature.properties.locked) { feature.locked = true;  delete feature.properties.locked }
//             if (feature.properties.hidden) { feature.hidden = true; delete feature.properties.hidden }
//             return {
//               id: `feature:${layer.id.split(':')[1]}/${uuid()}`,
//               ...feature,
//               ...symbols.meta(feature)
//             }
//           })

//           return layer
//         })
//       )
//     })
//   })

//   const readProjects = () => new Promise((resolve, reject) => {
//     const uuidPattern = /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89AB][a-f\d]{3}-[a-f\d]{12}$/i
//     fs.readdir(PROJECTS, { withFileTypes: true }, (err, files) => {
//       if (err) return reject(err)
//       resolve(files
//         .filter(dirent => dirent.isDirectory())
//         .filter(dirent => uuidPattern.test(dirent.name))
//         .map(dirent => dirent.name)
//         .filter(name => !projects.find(({ id }) => id.includes(name)))
//       )
//     })
//   })

//   readProjects().then(projects => projects.map(async project => {
//     const filename = path.join(databases, project)
//     const db = levelup(encoding(leveldown(filename), { valueEncoding: 'json' }))
//     const layers = await readLayers(project)
//     const ops = layers.reduce((acc, layer) => {
//       acc.push({ type: 'put', key: layer.id, value: layer })
//       layer.features.reduce((acc, feature) => {
//         acc.push({ type: 'put', key: feature.id, value: feature })
//         return acc
//       }, acc)
//       return acc
//     }, [])
//     await db.batch(ops)
//     await db.close()
//   }))

//   await (async () => {
//     const projects = await readProjects()
//     const ps = projects.map(async project => {
//       const meta = JSON.parse(fs.readFileSync(path.join(PROJECTS, project, 'metadata.json'), 'utf8'))
//       const id = `project:${project}`
//       return { type: 'put', key: id, value: { ...meta, id } }
//     })
//     const ops = await Promise.all(ps)
//     await master.batch(ops)
//   })()
// }

const loadProjects = async () => {
  const options = { keys: false, values: true, gte: 'project:', lte: 'project:' + '\xff' }
  const projects = await readMaster(options)

  if (projects.length) return projects

  // Create new/open project:
  const project = {
    id: `project:${uuid()}`,
    name: 'Untitled Project',
    open: true
  }

  await put(project)
  return [project]
}

/**
 *
 */
export const open = async () => {
  const projects = await loadProjects()
  const openProjects = projects.filter(project => project.open)
  if (openProjects.length) openProjects.forEach(createWindow)
  else R.take(1, projects).forEach(createWindow)
}
