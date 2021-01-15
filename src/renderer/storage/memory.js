const store = {}

const setItem = item => store[item.id] = item
const getItem = id => store[id]
const removeItem = id => delete store[id]
const length = () => Object.keys(store).length
const key = n => Object.keys(store)[n]
const keys = () => Object.keys(store)

const getItems = ids => ids.map(getItem)
const updateItem = fn => item => { fn(item); setItem(item) }
const updateKey = fn => id => updateItem(fn)(getItem(id))

export const storage = {
  setItem, getItem, getItems, removeItem,
  length, key, keys,
  updateKey, updateItem
}
