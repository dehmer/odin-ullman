import * as R from 'ramda'

const clear = false
const store = window.localStorage
if (clear) window.localStorage.clear()

const setItem = item => store.setItem(item.id, JSON.stringify(item))
const getItem = id => JSON.parse(store.getItem(id))
const removeItem = id => store.removeItem(id)
const length = () => store.length
const key = n => store.key(n)
const keys = () => R.range(0, store.length).map(key)

const getItems = ids => ids.map(getItem)
const updateItem = fn => item => { fn(item); setItem(item) }
const updateKey = fn => id => updateItem(fn)(getItem(id))

export const storage = {
  setItem, getItem, getItems, removeItem,
  length, key, keys,
  updateKey, updateItem
}
