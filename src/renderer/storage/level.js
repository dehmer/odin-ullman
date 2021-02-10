import path from 'path'
import fs from 'fs'
import * as R from 'ramda'
import uuid from 'uuid-random'
import levelup from 'levelup'
import leveldown from 'leveldown'
import encoding from 'encoding-down'
import { ipcRenderer } from 'electron'
import emitter from '../emitter'
import { isProject } from './ids'
import * as symbols from './symbols'

var project

;(async () => {
  const options = await ipcRenderer.invoke('ipc.query.project')
  const databases = path.join(options.userData, 'databases')
  const filename = path.join(databases, options.projectId.split(':')[1])
  project = levelup(encoding(leveldown(filename), { valueEncoding: 'json' }))
  emitter.emit('project/open')
})()



const isMasterKey = key => key.startsWith('project:') ||
  key.startsWith('symbol:') ||
  key.startsWith('import:')


/**
 *
 */
export const put = async (item, options) => {
  const quiet = options && options.quiet
  const optional = options && options.optional

  if (isMasterKey(item.id)) await ipcRenderer.invoke('ipc.command.master.put', item)
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
  if (isMasterKey(key)) return ipcRenderer.invoke('ipc.query.master.value', key)
  else return project ? project.get(key).catch(() => null) : null
}


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
    const [masterIds, projectIds] = R.partition(isMasterKey, arg)
    const xm = await ipcRenderer.invoke('ipc.query.master.values', masterIds)
    const xp = await projectIds.reduce(async (accp, id) => {
      const acc = await accp
      acc.push(await value(id))
      return acc
    }, [])
    return xm.concat(xp)
  }
  else {
    const prefix = arg
    const options = prefix
      ? { keys: false, values: true, gte: prefix, lte: prefix + '\xff' }
      : { keys: false, values: true }

    if (!prefix) {
      const xm = await ipcRenderer.invoke('ipc.query.master.values', null)
      const xp = await readProject(options)
      return xm.concat(xp)
    }
    else if (isMasterKey(prefix)) return ipcRenderer.invoke('ipc.query.master.values', prefix)
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

  return readProject(options)
}


/**
 *
 */
export const batch = async (ops, options) => {
  const quiet = options && options.quiet

  const [masterOps, projectOps] = R.partition(op => isMasterKey(op.key), ops)
  if (masterOps.length) await ipcRenderer.invoke('ipc.command.master.batch', ops)
  if (projectOps.length) await project.batch(projectOps)
  if (!quiet) emitter.emit('storage/batch', { ops })
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

  // Populate storage with symbols if missing:
  const id = symbol => `symbol:${symbol.sidc.substring(0, 10)}`
  await master.batch(Object.values(symbols.symbols).map(symbol => {
    symbol.id = id(symbol)
    return { type: 'put', key: symbol.id, value: symbol }
  }))
}
