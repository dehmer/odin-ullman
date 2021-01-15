// import { storage } from './memory'
import { storage } from './local'
import emitter from '../emitter'

const tx = fn => {
  const addition = []
  const removal = []
  const update = {}

  const updateItem_ = fn => item => { storage.updateItem(fn)(item); update[item.id] = item }
  const updateKey_ = fn => id => updateItem_(fn)(storage.getItem(id))

  fn({
    setItem: item => { storage.setItem(item); addition.push(item) },
    getItem: storage.getItem,
    removeItem: id => { storage.removeItem(id); removal.push(id) },
    length: storage.length,
    key: storage.key,
    keys: storage.keys,
    getItems: storage.getItems,
    updateItem: updateItem_,
    updateKey: updateKey_
  })

  return { addition, removal, update: Object.values(update) }
}

const txn = fn => event => {
  const changes = tx(storage => fn(storage, event))
  emitter.emit('storage/updated', changes)
}

export { storage, tx, txn }
