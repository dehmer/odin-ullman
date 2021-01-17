import level from 'level'
import { ipcRenderer } from 'electron'
import emitter from '../emitter'

// const master = level('master', { valueEncoding: 'json' })
var project = level('4cd84a72-adfe-4156-9c49-23436661c441', { valueEncoding: 'json' })

ipcRenderer.on('app-close', async () => {
  await project.close()
})

export const setItem = async (item, quiet = false) => {
  await project.put(item.id, item)
  if (!quiet) emitter.emit('storage/put', { key: item.id, value: item })
}

export const getItem = key => project.get(key)

export const getItems = prefix => new Promise((resolve, reject) => {
  const xs = []
  const options = { keys: false, values: true, gte: prefix, lte: prefix + '\xff' }
  project.createReadStream(options)
    .on('data', data => xs.push(data))
    .on('error', reject)
    .once('end', () => resolve(xs))
})

export const keys = prefix => new Promise((resolve, reject) => {
  const xs = []
  const options = prefix
    ? { keys: true, values: false, gte: prefix, lte: prefix + '\xff' }
    : { keys: true, values: false }

  project.createReadStream(options)
    .on('data', data => xs.push(data))
    .on('error', reject)
    .once('end', () => resolve(xs))
})

export const forEach = fn => new Promise((resolve, reject) => {
  const options = { keys: false, values: true }
  project.createReadStream(options)
    .on('data', fn)
    .on('error', reject)
    .once('end', () => resolve())
})

export const map = fn => new Promise((resolve, reject) => {
  const xs = []
  const options = { keys: false, values: true }
  project.createReadStream(options)
    .on('data', data => xs.push(fn(data)))
    .on('error', reject)
    .once('end', () => resolve(xs))
})

export const batch = ops => project.batch(ops)
