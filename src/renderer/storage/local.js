import * as R from 'ramda'
import emitter from '../emitter'
import * as level from './level'

const clear = false
const store = window.localStorage
if (clear) window.localStorage.clear()

const setItem = (item, quiet) => {
  level.setItem(item, quiet)
  store.setItem(item.id, JSON.stringify(item))
}

const getItem = id => JSON.parse(store.getItem(id))
const removeItem = id => store.removeItem(id)
const length = () => store.length
const key = n => store.key(n)
const keys = (prefix = '') => {
  const keys = R.range(0, store.length).map(key)
  return prefix
    ? keys.filter(key => key.startsWith(prefix))
    : keys
}

const batch = ops => {
  ops.forEach(op => {
    if (op.type === 'del') removeItem(op.key)
    else if (op.type === 'put') setItem(op.value, true)
  })
}

export const storage = {
  setItem,
  getItem,
  removeItem,
  length,
  key,
  keys,
  batch
}
