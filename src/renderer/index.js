import React from 'react'
import ReactDOM from 'react-dom'
import Mousetrap from 'mousetrap'
import './index.css'
import { App } from './components/App'
import { loadLayerFiles } from './model/io'
import './storage/command'
import './storage/action'
import './model/properties'
import emitter from './emitter'

const bindings = [
  ['command+1', () => emitter.emit('search/scope/all')],
  ['command+2', () => emitter.emit('search/scope/layer')],
  ['command+3', () => emitter.emit('search/scope/feature')],
  ['command+4', () => emitter.emit('search/scope/link')],
  ['command+5', () => emitter.emit('search/scope/group')],
  ['command+6', () => emitter.emit('search/scope/symbol')],
  ['command+7', () => emitter.emit('search/scope/place')],
  ['command+8', () => emitter.emit('search/scope/project')],
  ['f1', () => emitter.emit('storage/bookmark')],
  ['f2', () => emitter.emit('storage/group')],
  ['f3', () => emitter.emit('storage/snapshot')],
  ['f4', () => emitter.emit('storage/layer')],
  ['f5', () => emitter.emit('storage/project')]
]

bindings.forEach(([key, fn]) => Mousetrap.bind(key, fn))

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
