import * as R from 'ramda'
import uuid from 'uuid-random'
import levelup from 'levelup'
import leveldown from 'leveldown'
import encoding from 'encoding-down'
import fs from 'fs'
import emitter from '../emitter'
import { isProject } from './ids'

const master = levelup(encoding(leveldown('./db/master'), { valueEncoding: 'json' }))
var project /* last open project is loaded below */

const isMasterKey = key => key.startsWith('project:') || key.startsWith('symbol:')


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
  if (Array.isArray(arg)) return await Promise.all(arg.map(value))
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
  emitter.emit('storage/batch', { ops })
}


/**
 * master only for now
 */
export const exists = prefix => new Promise((resolve, reject) => {
  const options = { keys: true, values: false, gte: prefix, lte: prefix + '\xff' }
  master.createReadStream(options)
    .on('data', () => resolve(true))
    .on('error', reject)
    .once('end', () => resolve(false))
})


/**
 *
 */
;(async () => {
  const options = { keys: false, values: true, gte: 'project:', lte: 'project:' + '\xff' }
  const projects = await readMaster(options)
  const project = projects.find(project => project.open) || {
    id: `project:${uuid()}`,
    name: 'Project',
    open: true
  }

  batch([{ type: 'put', key: project.id, value: project }])
})()


/**
 *
 */
emitter.on('storage/batch', async event => {
  const path = id => `./db/${id.split(':')[1]}`
  const ops = event.ops.filter(op => isProject(op.key))

  const isOpen = id => {
    if (!project) return false
    if (!project.isOpen()) return false
    const location = project.db.db.location
    return location === path(id)
  }

  // delete database file(s) (if any)
  await Promise.all(ops
    .filter(op => op.type === 'del')
    .map(async op => {
      if (isOpen(op.key)) { await project.close(); project = null }
      fs.rmdirSync(path(op.key), { recursive: true })
    })
  )

  // open project (if any)
  await Promise.all(ops
    .filter(op => op.type === 'put' && op.value.open)
    .map(async op => {
      if (project && project.isOpen()) await project.close()
      project = levelup(encoding(leveldown(path(op.key)), { valueEncoding: 'json' }))
      emitter.emit('project/open')
    })
  )
})
