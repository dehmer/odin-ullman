import * as R from 'ramda'
import levelup from 'levelup'
import leveldown from 'leveldown'
import encoding from 'encoding-down'
import emitter from '../emitter'
import { storage } from './local'

// const master = level('master', { valueEncoding: 'json' })
const master = levelup(encoding(leveldown('./master'), { valueEncoding: 'json' }))
var project = levelup(encoding(leveldown('./4cd84a72-adfe-4156-9c49-23436661c441'), { valueEncoding: 'json' }))

// ;(async () => {
//   await project.clear()
// })()

export const projectStore = () => project

export const setItem = async (item, quiet = false) => {
  await project.put(item.id, item)
  storage.setItem(item, quiet)
  if (!quiet) emitter.emit('storage/put', { key: item.id, value: item })
}

export const getItem = key => project.get(key)

export const getItems = (prefix, p = (() => true)) => new Promise((resolve, reject) => {
  const xs = []
  const options = prefix
    ? { keys: false, values: true, gte: prefix, lte: prefix + '\xff' }
    : { keys: false, values: true }

  project.createReadStream(options)
    .on('data', data => p(data) ? xs.push(data) : R.always())
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

export const batch = async ops => {
  await project.batch(ops)
  storage.batch(ops)
  emitter.emit('storage/batch', { ops })
}
