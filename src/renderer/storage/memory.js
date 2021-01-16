const store = {}

const setItem = item => store[item.id] = item
const getItem = id => store[id]
const removeItem = id => delete store[id]
const length = () => Object.keys(store).length
const key = n => Object.keys(store)[n]
const keys = () => Object.keys(store)

export const storage = {
  setItem, getItem, removeItem,
  length, key, keys
}
