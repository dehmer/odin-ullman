/* eslint-disable react/prop-types */
import * as R from 'ramda'
import React from 'react'
import { CardList } from '../components/CardList'
import Card from '../components/Card'
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

  const firstSelected = list.findIndex(entry => entry.selected)
  const focus = firstSelected !== -1
    ? firstSelected
    : state.focus <= list.length - 1
      ? state.focus
      : -1

  return { list, focus }
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
  const focus = metaKey
    ? list.length - 1
    : Math.min(list.length - 1, state.focus + 1)

  const currentEntry = list[state.focus]
  const nextEntry = list[focus]
  const selected = shiftKey
    ? nextEntry.selected
      ? R.uniq([...toggleSelection(currentEntry), nextEntry.id])
      : R.uniq([...selection.selected(), nextEntry.id, currentEntry.id])
    : []

  setTimeout(() => selection.set(selected), 0)
  return { ...state, focus }
}


/**
 * TODO: respect continuous selection block
 */
handlers['keydown/ArrowUp'] = (state, { shiftKey, metaKey }) => {
  if (state.focus === -1) return state
  const list = state.list
  const focus = metaKey
    ? 0
    : Math.max(0, state.focus - 1)

  const currentEntry = list[state.focus]
  const nextEntry = list[focus]

  const selected = shiftKey
    ? nextEntry.selected
      ? R.uniq([...toggleSelection(currentEntry), nextEntry.id])
      : R.uniq([...selection.selected(), nextEntry.id, currentEntry.id])
    : []

  setTimeout(() => selection.set(selected), 0)
  return { ...state, focus }
}


/**
 *
 */
handlers['keydown/Home'] = (state, { shiftKey }) => {
  if (state.focus === -1) return state
  const focus = state.list.length ? 0 : -1
  return { ...state, focus }
}


/**
 *
 */
handlers['keydown/End'] = (state, { shiftKey }) => {
  if (state.focus === -1) return state
  const focus = state.list.length ? state.list.length - 1 : -1
  return { ...state, focus }
}


/**
 *
 */
handlers['keydown/Enter'] = state => {
  const focus = state.focus
  if (focus === -1) return state
  if (!(state.list[focus].capabilities || '').includes('RENAME')) return state
  const list = [...state.list]
  list[focus] = { ...list[focus], edit: true }
  return { list, focus }
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
handlers['keydown/Backspace'] = (state, { shiftKey, metaKey }) => R.tap(state => {
  if (!metaKey || state.focus === -1) return
  const include = (entry, index) => entry.selected || index === state.focus
  const ids = state.list.filter(include).map(R.prop('id'))
  emitter.emit('items/remove', { ids })
}, state)


/**
 * Space.
 */
handlers['keydown/ '] = state => R.tap(state => {
  if (state.focus === -1) return
  selection.set(toggleSelection(state.list[state.focus]))
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
  const { list, focus } = state
  const block = continuousSelection(list, [focus])
  const [from, to] = focus < index ? [focus, index] : [index, focus]
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
  return { ...state, focus: index }
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
  const [state, dispatch] = React.useReducer(reducer, { list: [], focus: -1 })
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
    const paths = ['search/result/updated', 'selection']
    paths.forEach(path => emitter.on(path, dispatch))
    return () => paths.forEach(path => emitter.off(path, dispatch))
  }, [])

  React.useEffect(() => {
    scrollIntoView(state.focus)
  }, [state])

  const handleClick = React.useCallback((index, { metaKey, shiftKey }) => {
    dispatch({ path: 'click', index, shiftKey, metaKey })
  }, [state])

  const card = (props, index) => <Card
    key={props.id}
    ref={cardrefs[index]}
    focus={state.focus === index}
    onClick={event => handleClick(index, event)}
    {...props}
  />

  const handleKeyDown = event => {
    const { key, shiftKey, metaKey } = event
    dispatch({ path: `keydown/${key}`, shiftKey, metaKey })
    if (key === 'Enter' && state.focus !== -1) ref.current.focus()
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
