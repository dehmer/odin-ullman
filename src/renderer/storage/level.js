import os from 'os'
import path from 'path'
import fs from 'fs'
import * as R from 'ramda'
import uuid from 'uuid-random'
import levelup from 'levelup'
import leveldown from 'leveldown'
import encoding from 'encoding-down'
import emitter from '../emitter'
import { isProject } from './ids'
import * as symbols from './symbols'

if (!fs.existsSync('db')) fs.mkdirSync('db')
const master = levelup(encoding(leveldown('./db/master'), { valueEncoding: 'json' }))
var project /* last open project is loaded below */


const isMasterKey = key => key.startsWith('project:') ||
  key.startsWith('symbol:') ||
  key.startsWith('import:')


/**
 *
 */
const updateProjects = async ops => {
  const path = id => `./db/${id.split(':')[1]}`
  const isOpen = id => project &&
    project.isOpen() &&
    project.db.db.location === path(id)

  const close = async () => {
    await project.close()
    project = null
  }

  // delete database file(s) (if any)
  await Promise.all(ops
    .filter(op => isProject(op.key) && op.type === 'del')
    .map(async op => {
      if (isOpen(op.key)) await close()
      fs.rmdirSync(path(op.key), { recursive: true })
    })
  )

  // open project (if any)
  await Promise.all(ops
    .filter(op => isProject(op.key) && op.type === 'put' && op.value.open)
    .map(async op => {
      if (project && project.isOpen()) await close()
      project = levelup(encoding(leveldown(path(op.key)), { valueEncoding: 'json' }))
      emitter.emit('project/open')
    })
  )
}


/**
 *
 */
export const put = async (item, ops) => {
  const quiet = ops && ops.quiet
  const optional = ops && ops.optional

  if (isMasterKey(item.id)) await master.put(item.id, item)
  else if (!project) {
    if (!optional) console.error('project not open; discarding value', item.id)
    else { /* silently ignore */ }
  }
  else await project.put(item.id, item)
  if (!quiet) emitter.emit('storage/put', { key: item.id, value: item })
}


/**
 *
 */
export const value = key => {
  if (isMasterKey(key)) return master.get(key).catch(() => null)
  else return project ? project.get(key).catch(() => null) : null
}


/**
 *
 */
const readMaster = options => new Promise((resolve, reject) => {
  const xs = []
  master.createReadStream(options)
    .on('data', data => xs.push(data))
    .on('error', reject)
    .once('end', () => resolve(xs))
})


/**
 *
 */
const readProject = options => new Promise((resolve, reject) => {
  if (!project) return resolve([])

  const xs = []
  project.createReadStream(options)
    .on('data', data => xs.push(data))
    .on('error', reject)
    .once('end', () => resolve(xs))
})


/**
 *
 */
export const values = async arg => {
  if (Array.isArray(arg)) {
    console.error('[level] deprecated.')
    return await Promise.all(arg.map(value))
  }
  else {
    const prefix = arg
    const options = prefix
      ? { keys: false, values: true, gte: prefix, lte: prefix + '\xff' }
      : { keys: false, values: true }

    if (!prefix) {
      const xm = await readMaster(options)
      const xp = await readProject(options)
      return xm.concat(xp)
    }
    else if (isMasterKey(prefix)) return readMaster(options)
    else return readProject(options)
  }
}


/**
 *
 */
export const keys = async prefix => {
  const options = prefix
    ? { keys: true, values: false, gte: prefix, lte: prefix + '\xff' }
    : { keys: true, values: false }

  if (!prefix) return (await readMaster(options)).concat(await readProject(options))
  else if (isMasterKey(prefix)) return readMaster(options)
  else return readProject(options)
}


/**
 *
 */
export const batch = async ops => {
  const [masterOps, projectOps] = R.partition(op => isMasterKey(op.key), ops)
  if (masterOps.length) await master.batch(masterOps)
  if (projectOps.length) await project.batch(projectOps)

  await updateProjects(ops)
  emitter.emit('storage/batch', { ops })
}


const exists = prefix => new Promise((resolve, reject) => {
  const options = { keys: true, values: false, gte: prefix, lte: prefix + '\xff' }
  master.createReadStream(options)
    .on('data', () => resolve(true))
    .on('error', reject)
    .once('end', () => resolve(false))
})

const readSymbols = async () => {
  if (await exists('symbol:')) return

  console.log('loading symbols...')
  // Populate storage with symbols if missing:
  const id = symbol => `symbol:${symbol.sidc.substring(0, 10)}`
  await master.batch(Object.values(symbols.symbols).map(symbol => {
    symbol.id = id(symbol)
    return { type: 'put', key: symbol.id, value: symbol }
  }))
}

/**
 *
 */
const importProjects = async projects => {
  const USER_HOME = os.homedir()
  const ODIN_HOME = path.join(USER_HOME, 'ODIN')
  const PROJECTS = path.join(ODIN_HOME, 'projects')

  // Only import once:
  const imports = await values('import:')
  if (imports.find(x => x.path === USER_HOME)) return
  await put({ id: `import:${uuid()}`, path: USER_HOME}, { quiet: true })

  const readLayers = project => new Promise((resolve, reject) => {
    fs.readdir(path.join(PROJECTS, project, 'layers'), { withFileTypes: true }, (err, files) => {
      if (err) return reject(err)
      resolve(files
        .filter(dirent => dirent.isFile())
        .filter(dirent => dirent.name.endsWith('.json'))
        .map(dirent => dirent.name)
        .map(layer => path.join(PROJECTS, project, 'layers', layer))
        .map(layer => {
          const json = JSON.parse(fs.readFileSync(layer, 'utf8'))
          json.name = path.basename(layer, '.json')
          return json
        })
        .map(R.tap(layer => layer.id = `layer:${uuid()}`))
        .map(layer => {
          layer.features = layer.features.map(feature => {
            delete feature.id
            delete feature.properties.layerId
            if (feature.properties.locked) { feature.locked = true;  delete feature.properties.locked }
            if (feature.properties.hidden) { feature.hidden = true; delete feature.properties.hidden }
            return {
              id: `feature:${layer.id.split(':')[1]}/${uuid()}`,
              ...feature,
              ...symbols.meta(feature)
            }
          })

          return layer
        })
      )
    })
  })

  const readProjects = () => new Promise((resolve, reject) => {
    const uuidPattern = /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89AB][a-f\d]{3}-[a-f\d]{12}$/i
    fs.readdir(PROJECTS, { withFileTypes: true }, (err, files) => {
      if (err) return reject(err)
      resolve(files
        .filter(dirent => dirent.isDirectory())
        .filter(dirent => uuidPattern.test(dirent.name))
        .map(dirent => dirent.name)
        .filter(name => !projects.find(({ id }) => id.includes(name)))
      )
    })
  })

  readProjects().then(projects => projects.map(async project => {
    const db = levelup(encoding(leveldown(`./db/${project}`), { valueEncoding: 'json' }))
    const layers = await readLayers(project)
    const ops = layers.reduce((acc, layer) => {
      acc.push({ type: 'put', key: layer.id, value: layer })
      layer.features.reduce((acc, feature) => {
        acc.push({ type: 'put', key: feature.id, value: feature })
        return acc
      }, acc)
      return acc
    }, [])
    await db.batch(ops)
    await db.close()
  }))

  await (async () => {
    const projects = await readProjects()
    const ps = projects.map(async project => {
      const meta = JSON.parse(fs.readFileSync(path.join(PROJECTS, project, 'metadata.json'), 'utf8'))
      const id = `project:${project}`
      return { type: 'put', key: id, value: { ...meta, id } }
    })
    const ops = await Promise.all(ps)
    await master.batch(ops)
  })()
}

/**
 *
 */
;(async () => {
  await readSymbols()

  const options = { keys: false, values: true, gte: 'project:', lte: 'project:' + '\xff' }
  const projects = await readMaster(options)
  await importProjects(projects)

  const project = projects.find(project => project.open) || {
    id: `project:${uuid()}`,
    name: 'Project',
    open: true
  }

  batch([{ type: 'put', key: project.id, value: project }])
})()
