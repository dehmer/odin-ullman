import * as R from 'ramda'
import React from 'react'
import { CardList } from './CardList'
import Card from './Card'
import { Search } from './Search'
import { Scopebar } from './Scopebar'
import emitter from '../emitter'
import selection from '../selection'


/**
 *
 */
const toggleSelection = entry => entry
  ? entry.selected
    ? selection.selected().filter(x => x !== entry.id)
    : [...selection.selected(), entry.id]
  : selection.selected()

const handlers = {}


/**
 *
 */
handlers['search/result/updated'] = (state, { result }) => {
  const list = [...result]
  list.forEach((entry, i, xs) => {
    if (selection.isSelected(entry.id)) xs[i] = { ...entry, selected: true }
  })

  // Last focused entry still present? Update focus index.
  if (state.focusId) {
    const focusIndex = list.findIndex(entry => entry.id === state.focusId)
    if (focusIndex !== - 1) return { list, focusIndex}
  }

  const firstSelected = list.findIndex(entry => entry.selected)
  const focusIndex = firstSelected !== -1
    ? firstSelected
    : state.focusIndex <= list.length - 1
      ? state.focusIndex
      : -1

  return { list, focusIndex }
}

/**
 * Reset focus on new search provider.
 */
handlers['search/provider/updated'] = state => {
  return { ...state, focusIndex: -1, focusId: null }
}

/**
 *
 */
handlers.selection = (state, { selected, deselected }) => {
  return R.tap(state => state.list.forEach((entry, i, xs) => {
    if (selected.includes(entry.id)) xs[i] = { ...entry, selected: true }
    else if (deselected.includes(entry.id)) xs[i] = { ...entry, selected: false }
  }))({ ...state })
}


/**
 * TODO: respect continuous selection block
 */
handlers['keydown/ArrowDown'] = (state, { shiftKey, metaKey }) => {
  const list = state.list
  const focusIndex = metaKey
    ? list.length - 1
    : Math.min(list.length - 1, state.focusIndex + 1)

  const currentEntry = list[state.focusIndex]
  const nextEntry = list[focusIndex]
  const selected = shiftKey
    ? nextEntry.selected
      ? R.uniq([...toggleSelection(currentEntry), nextEntry.id])
      : R.uniq([...selection.selected(), nextEntry.id, currentEntry.id])
    : []

  setTimeout(() => selection.set(selected), 0)
  return { ...state, focusIndex }
}


/**
 * TODO: respect continuous selection block
 */
handlers['keydown/ArrowUp'] = (state, { shiftKey, metaKey }) => {
  if (state.focusIndex === -1) return state
  const list = state.list
  const focusIndex = metaKey
    ? 0
    : Math.max(0, state.focusIndex - 1)

  const currentEntry = list[state.focusIndex]
  const nextEntry = list[focusIndex]

  const selected = shiftKey
    ? nextEntry.selected
      ? R.uniq([...toggleSelection(currentEntry), nextEntry.id])
      : R.uniq([...selection.selected(), nextEntry.id, currentEntry.id])
    : []

  setTimeout(() => selection.set(selected), 0)
  return { ...state, focusIndex }
}


/**
 *
 */
handlers['keydown/Home'] = (state, { shiftKey }) => {
  if (state.focusIndex === -1) return state
  const focusIndex = state.list.length ? 0 : -1
  return { ...state, focusIndex }
}


/**
 *
 */
handlers['keydown/End'] = (state, { shiftKey }) => {
  if (state.focusIndex === -1) return state
  const focusIndex = state.list.length ? state.list.length - 1 : -1
  return { ...state, focusIndex }
}


/**
 *
 */
handlers['keydown/Enter'] = state => {
  const focusIndex = state.focusIndex
  if (focusIndex === -1) return state
  if (!(state.list[focusIndex].capabilities || '').includes('RENAME')) return state
  const list = [...state.list]
  list[focusIndex] = { ...list[focusIndex], edit: true }
  return { list, focusIndex, focusId: list[focusIndex].id }
}


/**
 *
 */
handlers['keydown/a'] = (state, { shiftKey, metaKey }) => R.tap(({ list }) => {
  if (!metaKey) return
  const selected = list.every(R.prop('selected')) ? [] : list.map(R.prop('id'))
  selection.set(selected)
}, state)

/**
 *
 */
const remove = state => {
  // TODO: set focusIndex to first selected
  const { focusIndex, list} = state
  if (focusIndex === -1) return state

  const include = (entry, index) => entry.selected || index === focusIndex
  const ids = list.filter(include).map(R.prop('id'))
  emitter.emit('items/remove', { ids })

  const firstSelected = list.findIndex(entry => entry.selected)
  const focus = firstSelected !== -1 ? firstSelected : focusIndex
  return { ...state, focusIndex: focus, focusId: null }
}

// All platforms:
handlers['keydown/Delete'] = remove

// Additionally, Mac only:
if (navigator.platform && navigator.platform.toLowerCase().includes('mac')) {
  handlers['keydown/Backspace'] = (state, { metaKey }) => metaKey ? remove(state) : state
}

/**
 * Space.
 */
handlers['keydown/ '] = state => R.tap(state => {
  if (state.focusIndex === -1) return
  selection.set(toggleSelection(state.list[state.focusIndex]))
}, state)


/**
 *
 */
const continuousSelection = (list, indexes) => {
  const [head, last] = [R.head(indexes), R.last(indexes)]
  const prepend = list[head - 1] && list[head - 1].selected ? [head - 1] : []
  const append = list[last + 1] && list[last + 1].selected ? [last + 1] : []
  if (!prepend.length && !append.length) return indexes
  else return continuousSelection(list, [...prepend, ...indexes, ...append])
}


/**
 * FIXME: currently not quite right
 */
const rangeSelection = (state, index) => {
  const { list, focusIndex } = state
  const block = continuousSelection(list, [focusIndex])
  const [from, to] = focusIndex < index ? [focusIndex, index] : [index, focusIndex]
  const range = R.range(from, to + 1)
  return R.uniq([...range, ...block]).map(index => list[index].id)
}


/**
 *
 */
handlers.click = (state, { index, shiftKey, metaKey }) => {
  const selected = metaKey
    ? toggleSelection(state.list[index])
    : shiftKey
      ? rangeSelection(state, index)
      : []

  // Allow new focus to be applied before selection update:
  setTimeout(() => selection.set(selected), 0)
  return { ...state, focusIndex: index }
}


/**
 *
 */
const reducer = (state, event) => {
  const handler = handlers[event.path]
  return handler ? handler(state, event) : state
}


/**
 *
 */
const Spotlight = () => {
  const [state, dispatch] = React.useReducer(reducer, {
    list: [],
    focusIndex: -1,
    focusId: null
  })

  const ref = React.createRef()
  const cardrefs = state.list.map(_ => React.createRef())

  const scrollIntoView = index => {
    cardrefs[index] &&
    cardrefs[index].current &&
    cardrefs[index].current.scrollIntoView({
      behavior: 'instant',
      block: 'nearest'
    })
  }

  React.useEffect(() => {
    // Forward these events to reducer:
    const paths = ['search/result/updated', 'selection', 'search/provider/updated']
    paths.forEach(path => emitter.on(path, dispatch))
    return () => paths.forEach(path => emitter.off(path, dispatch))
  }, [])

  React.useEffect(() => {
    scrollIntoView(state.focusIndex)
  }, [state])

  const handleClick = React.useCallback((index, { metaKey, shiftKey }) => {
    dispatch({ path: 'click', index, shiftKey, metaKey })
  }, [state])

  const card = (props, index) => <Card
    key={props.id}
    ref={cardrefs[index]}
    focus={state.focusIndex === index}
    onClick={event => handleClick(index, event)}
    {...props}
  />

  const handleKeyDown = event => {
    const { key, shiftKey, metaKey } = event
    dispatch({ path: `keydown/${key}`, shiftKey, metaKey })
    if (key === 'Enter' && state.focusIndex !== -1) ref.current.focus()
  }

  return (
    <div
      ref={ref}
      className="spotlight panel"
      tabIndex='0'
      onKeyDown={handleKeyDown}
    >
      <Scopebar/>
      <Search/>
      <CardList>{state.list.map(card)}</CardList>
    </div>
  )
}

export default React.memo(Spotlight)
