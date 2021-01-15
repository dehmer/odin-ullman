// Track selections throughout the application.
// Selections are URIs.
import emitter from './emitter'

// Current selections.
let state = []

/**
 * select :: [uri] -> unit
 * Add selections.
 */
const select = uris => {
  if (!uris) return
  if (!Array.isArray(uris)) throw new Error('invalid argument; array expected')
  if (uris.length === 0) return
  if (uris.some(x => typeof x !== 'string')) throw new Error('invalid argument; string element expected')

  const selected = uris.filter(x => !state.includes(x))
  state = [...state, ...selected]
  if (selected.length) emitter.emit('selection', { selected, deselected: [] })
}

/**
 * deselect :: [uri] => unit
 * Remove all or given selections.
 */
const deselect = uris => {
  if (uris && !Array.isArray(uris)) throw new Error('invalid argument; array expected')
  if (uris.length === 0) return
  if (uris && uris.some(x => typeof x !== 'string')) throw new Error('invalid argument; string element expected')

  const deselected = uris.filter(x => state.includes(x))
  state = state.filter(x => !deselected.includes(x))
  if (deselected.length) emitter.emit('selection', { deselected, selected: [] })
}

const set = uris => {
  if (uris && !Array.isArray(uris)) throw new Error('invalid argument; array expected')
  if (uris && uris.some(x => typeof x !== 'string')) throw new Error('invalid argument; string element expected')

  const selected = uris.filter(x => !state.includes(x))
  const deselected = state.filter(x => !uris.includes(x))

  if (!selected.length && !deselected.length) return
  state = [...uris]
  emitter.emit('selection', { deselected, selected })
}

const isEmpty = () => state.length === 0
const isSelected = uri => state.includes(uri)
const selected = (p = () => true) => state.filter(p)

export default {
  set,
  select,
  deselect,
  isEmpty,
  isSelected,
  selected
}
