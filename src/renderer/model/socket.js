import * as level from '../storage/level'
import { isFeature, isLayer, layerId } from '../storage/ids'
import { source } from './source'
import emitter from '../emitter'
import { readFeature } from '../storage/format'

const featureById = id => source.getFeatureById(id)
const addItem = item => {
  const feature = readFeature(item)
  source.addFeature(feature)

  const rotation = item.properties.rotate
    ? 2 * Math.PI - (item.properties.q / 180 * Math.PI)
    : 0

  if(item.follow) {
    const center = feature.getGeometry().getFirstCoordinate()
    emitter.emit('map/panto', { center, rotation })
  }
}

const sockets = {}

const socket = (id, url) => {
  const hidden = {}
  var socket

  const handlePut = (json) => {
    const items = json.type === 'Feature'
      ? [json]
      : json.features

    items.forEach(async item => {
      const mergedItem = { ...(await level.getItem(item.id)), ...item }
      level.setItem(mergedItem, true)
      const stale = featureById(item.id)
      if (stale) source.removeFeature(stale)
      if (!hidden[item.id]) addItem(mergedItem)
    })
  }

  const handleDelete = (id) => {
    const ids = [id]
    if (hidden[id] || featureById(id)) emitter.emit('items/remove', { ids })
  }
  const handleHide = (id) => {
    hidden[id] = true
  }
  const handleShow = (id) => {
    delete hidden[id]
  }

  try {
    socket = new WebSocket(url)
    socket.onopen = () => socket.send(JSON.stringify({ id, type: 'resume' }))
    socket.onerror = err => emitter.emit(`${id}/socket/error`, { err })
    socket.onclose = () => emitter.emit(`${id}/socket/close`)

    socket.onmessage = ({ data }) => {
      const json = JSON.parse(data)
      const items = Array.isArray(json) ? json : [json]

      items.forEach(order => {
        switch (order.type) {
          case 'put':
            handlePut(order.value)
            break;
          case 'del':
            handleDelete(order.key)
            break;
          case 'hide':
            handleHide(order.key)
            break;
          case 'show':
            handleShow(order.key)
            break;
        }
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
setInterval(async () => {
  (await level.getItems('layer:', layer => layer.type === 'socket' && layer.active && !sockets[layer.id]))
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
