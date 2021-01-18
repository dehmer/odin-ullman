#!/usr/bin/env node
import express from 'express'
import LatLon from 'geodesy/latlon-ellipsoidal-vincenty.js'
import WebSocket from 'ws'

const app = express()
app.use(express.static('dist'))

function noop() {}
function heartbeat() { this.alive = true }

const wss = new WebSocket.Server({ noServer: true })

// constant between server restarts:
const jammerUUID = '276f23c6-700f-4676-9959-928286eeea97'

const handler = function () {
  var layerId
  var active = true

  const loop = (direction, distance, bearing) => {
    setTimeout(() => {
      const p1 = new LatLon(59.436962, 24.753574)
      const p2 = p1.destinationPoint(distance, bearing)

      const id = `feature:${layerId.split(':')[1]}/${jammerUUID}`
      const feature = {
        type: 'Feature',
        id,
        geometry: {
          type: "Point",
          coordinates: [p2.lng, p2.lat]
        },
        properties: {
          sidc: 'SFAPMFJ---*****',
          t: "Da 'Jammin' Jamma"
        }
      }

      this.send(JSON.stringify(feature))
      active && loop(
        Math.random() > 0.95 ? -direction : direction,
        Math.random() > 0.5 ? distance + 1000 : distance - 1000,
        (bearing + Math.random() * 3 * direction) % 360
      )
    }, 50)
  }

  this.on('message', data => {
    const message = JSON.parse(data)
    switch (message.type) {
      case 'resume': {
        layerId = message.id
        active = true
        loop(1, 50000, 0)
        break
      }
      case 'suspend': {
        active = false
        break
      }
    }
  })
}


wss.on('connection', socket => {
  console.log('connection accepted.')
  socket.alive = true
  socket.on('pong', heartbeat)
  socket.handler = handler.bind(socket)
  socket.handler()
})

const interval = setInterval(() => {
  wss.clients.forEach(ws => {
    if (ws.alive === false) {
      console.log('terminating stale connection.')
      return ws.terminate()
    }
    ws.alive = false // should be flipped in heartbeat.
    ws.ping(noop)
  });
}, 10000)

wss.on('close', () => {
  clearInterval(interval)
})

const server = app.listen(3000)
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, socket => {
    wss.emit('connection', socket, request)
  })
})
