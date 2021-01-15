import React from 'react'
import ReactDOM from 'react-dom'
import Mousetrap from 'mousetrap'
import './index.css'
import { App } from './App'
import { loadLayerFiles } from './model/io'
import './storage/command'
import './storage/action'
import emitter from './emitter'

Mousetrap.bind('command+1', () => {
  emitter.emit('search/scope/all')
  return false
})

Mousetrap.bind('command+2', () => {
  emitter.emit('search/scope/layer')
  return false
})

Mousetrap.bind('command+3', () => {
  emitter.emit('search/scope/feature')
  return false
})

Mousetrap.bind('command+4', () => {
  emitter.emit('search/scope/link')
  return false
})

Mousetrap.bind('command+5', () => {
  emitter.emit('search/scope/group')
  return false
})

Mousetrap.bind('command+6', () => {
  emitter.emit('search/scope/symbol')
  return false
})

Mousetrap.bind('command+7', () => {
  emitter.emit('search/scope/place')
  return false
})

Mousetrap.bind('f1', () => {
  emitter.emit('storage/bookmark')
  return false
})

Mousetrap.bind('f2', () => {
  emitter.emit('storage/group')
  return false
})

Mousetrap.bind('f3', () => {
  emitter.emit('storage/snapshot')
  return false
})

/**
 * Create layer from last search.
 */
Mousetrap.bind('f4', () => {
  emitter.emit('storage/layer')
  return false
})

const app = document.createElement('div')
document.body.appendChild(app)
ReactDOM.render(<App/>, app)

const map = document.getElementById('map')

// Prevent browser from intercepting file:
app.addEventListener('drop', async event => {
  event.preventDefault()
  event.stopPropagation()
}, false)

map.addEventListener('dragover', event => {
  event.preventDefault()
  event.stopPropagation()
}, false)

map.addEventListener('drop', async event => {
  event.preventDefault()
  event.stopPropagation()
  const layers = await loadLayerFiles([...event.dataTransfer.files])
  emitter.emit('layers/import', ({ layers }))
}, false)
