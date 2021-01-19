import { storage } from '../storage'
import { isFeature, isLayer, layerId } from '../storage/ids'
import { source } from './source'
import emitter from '../emitter'
import { readFeature, readFeatures, writeFeatureObject } from '../storage/format'

const featureById = id => source.getFeatureById(id)

const sockets = {}

const socket = (id, url) => {
  const hidden = {}
  var socket

  try {
    socket = new WebSocket(url)
    socket.onopen = () => socket.send(JSON.stringify({ id, type: 'resume' }))
    socket.onerror = err => emitter.emit(`${id}/socket/error`, { err })
    socket.onclose = () => emitter.emit(`${id}/socket/close`)

    socket.onmessage = ({ data }) => {
      const item = JSON.parse(data)

      const features = item.type === 'Feature'
        ? [readFeature(item)]
        : readFeatures(item)

      features.forEach(feature => {
        storage.setItem(writeFeatureObject(feature), true)
        const stale = featureById(feature.getId())
        if (stale) source.removeFeature(stale)
        if (!hidden[feature.getId()]) source.addFeature(feature)
      })
    }
  } catch (err) {
    emitter.emit(`${id}/socket/error`, { err })
  }

  const handler = event => {
    event.ops.forEach(op => {
      if (op.type === 'put') {
        if (isLayer(op.key) && op.key === id) hidden[op.key] = op.value.hidden
        else if (isFeature(op.key) && layerId(op.key) === id) hidden[op.key] = op.value.hidden
      } else if (op.type === 'del') {
        if (isLayer(op.key) && op.key === id) socket.close()
      }
    })
  }

  emitter.on('storage/batch', handler)

  const close = () => {
    emitter.off('storage/batch', handler)
    if (!socket) return
    socket.send(JSON.stringify({ id, type: 'suspend' }))
    socket.close()
  }

  return {
    url,
    close
  }
}

// Register sockets for socket layers (incl. retry):
setInterval(() => {
  storage.keys()
    .filter(isLayer)
    .map(storage.getItem)
    .filter(layer => layer.type === 'socket')
    .filter(layer => layer.active && !sockets[layer.id])
    .forEach(layer => sockets[layer.id] = socket(layer.id, layer.url))
}, 5000)

/**
 *
 */
emitter.on('storage/put', ({ key, value }) => {
  if (!isLayer(key)) return
  if (value.type !== 'socket') return

  if (value.active) {
    sockets[key] = socket(key, value.url)
  } else {
    sockets[key] && sockets[key].close()
    delete sockets[key]
  }
})

emitter.on(':id/socket/close', ({ id }) => {
  delete sockets[id]
})

emitter.on(':id/socket/error', ({ id, err }) => {
  delete sockets[id]
})
