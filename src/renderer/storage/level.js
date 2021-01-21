import * as R from 'ramda'
import uuid from 'uuid-random'
import levelup from 'levelup'
import leveldown from 'leveldown'
import encoding from 'encoding-down'
import emitter from '../emitter'

const master = levelup(encoding(leveldown('./db/master'), { valueEncoding: 'json' }))
var project /* last open project is loaded below */

const isMasterKey = key => key.startsWith('project:') || key.startsWith('symbol:')

export const put = async (item, quiet = false) => {
  if (isMasterKey(item.id)) await master.put(item.id, item)
  else await project.put(item.id, item)
  if (!quiet) emitter.emit('storage/put', { key: item.id, value: item })
}

export const value = key => {
  if (isMasterKey(key)) return master.get(key).catch(() => null)
  else return project ? project.get(key).catch(() => null) : null
}

const readMaster = options => new Promise((resolve, reject) => {
  const xs = []
  master.createReadStream(options)
    .on('data', data => xs.push(data))
    .on('error', reject)
    .once('end', () => resolve(xs))
})

const readProject = options => new Promise((resolve, reject) => {
  const xs = []
  project.createReadStream(options)
    .on('data', data => xs.push(data))
    .on('error', reject)
    .once('end', () => resolve(xs))
})

export const values = async arg => {

  if (Array.isArray(arg)) return await Promise.all(arg.map(value))
  else {
    const options = arg
      ? { keys: false, values: true, gte: arg, lte: arg + '\xff' }
      : { keys: false, values: true }

    if (!arg) return (await readMaster(options)).concat(await readProject(options))
    else if (isMasterKey(arg)) return readMaster(options)
    else return readProject(options)
  }
}

export const keys = async prefix => {
  const options = prefix
    ? { keys: true, values: false, gte: prefix, lte: prefix + '\xff' }
    : { keys: true, values: false }

  if (!prefix) return (await readMaster(options)).concat(await readProject(options))
  else if (isMasterKey(prefix)) return readMaster(options)
  else return readProject(options)
}

export const batch = async ops => {
  const [masterOps, projectOps] = R.partition(op => isMasterKey(op.key), ops)
  await master.batch(masterOps)
  await project.batch(projectOps)
  emitter.emit('storage/batch', { ops })
}

// master only for now
export const exists = prefix => new Promise((resolve, reject) => {
  const options = { keys: true, values: false, gte: prefix, lte: prefix + '\xff' }
  master.createReadStream(options)
    .on('data', () => resolve(true))
    .on('error', reject)
    .once('end', () => resolve(false))
})

export const open = async id => {
  if (project) await project.close()
  const filename = `./db/${id.split(':')[1]}`
  project = levelup(encoding(leveldown(filename), { valueEncoding: 'json' }))
  emitter.emit('project/open')
}

;(async () => {
  const options = { keys: false, values: true, gte: 'project:', lte: 'project:' + '\xff' }
  const projects = await readMaster(options)
  var openProject = projects.find(project => project.open)

  if (!openProject) {
    openProject = {
      id: `project:${uuid()}`,
      name: 'Project',
      open: true
    }

    master.put(openProject.id, openProject)
  }

  await open(openProject.id)
})()

