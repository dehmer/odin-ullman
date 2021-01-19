#!/usr/bin/env node
import express from 'express'
import LatLon from 'geodesy/latlon-ellipsoidal-vincenty.js'
import WebSocket from 'ws'

const app = express()
app.use(express.static('dist'))

function noop() {}
function heartbeat() { this.alive = true }

const wss = new WebSocket.Server({ noServer: true })

const randomPosition = (lat, lng) => {
  var point = new LatLon(lat, lng)
  var heading = Math.random() * 360
  var distance = 200

  return {
    heading: () => heading,
    next: () => {
      heading = Math.random() > 0.6
        ? heading + 5 - Math.random() * 10
        : heading

      point = point.destinationPoint(distance, heading)
      return point
    }
  }
}

// constant between server restarts:
const beamUUIDs = [
  'dbe9a008-d5e6-4a31-91a9-d8909dc3fd5d',
  '5e67dfbd-dd5e-45c7-8ba5-458a6891c4c7',
  'ed806e39-b7d4-4d49-a17c-5b2f268f5c22'
]

const jammerUUID = '276f23c6-700f-4676-9959-928286eeea97'
const uaUUIDs = [
  'b67ad373-5783-45ef-9ea3-638c22285f83',
  '1c414201-4dd3-41de-8eb2-fb98b0ff12d1',
  '97f4f448-7d30-4dc8-b508-9ae983710bef'
]

const loopDelay = 100 /* ms */

const featureHandler = function () {
  var layerId
  var active = true

  const loop = (position) => {
    setTimeout(() => {
      const point = position.next()
      const feature = {
        type: 'Feature',
        id: `feature:${layerId.split(':')[1]}/${jammerUUID}`,
        geometry: { type: "Point", coordinates: [point.lng, point.lat] },
        properties: {
          sidc: 'SFAPMFJ---*****',
          t: "Da 'Jammin' Jamma"
        }
      }

      this.send(JSON.stringify(feature))
      active && loop(position)
    }, loopDelay)
  }

  this.on('message', data => {
    const message = JSON.parse(data)
    switch (message.type) {
      case 'resume': {
        layerId = message.id
        active = true
        loop(randomPosition(59.436962, 24.753574))
        break
      }
      case 'suspend': {
        active = false
        break
      }
    }
  })
}

const collectionHandler = function () {
  var layerId
  var active = true

  const loop = positions => {
    setTimeout(() => {
      const features = positions.map((position, index) => {
        const point = position.next()
        return {
          type: 'Feature',
          id: `feature:${layerId.split(':')[1]}/${uaUUIDs[index]}`,
          geometry: { type: "Point", coordinates: [point.lng, point.lat] },
          properties: {
            sidc: 'SHAPMFQS--*****',
            t: `UA ${index + 1}`,
            q: position.heading(),
            rotate: true
          }
        }
      })

      const collection = { type: 'FeatureCollection', features }
      this.send(JSON.stringify(collection))
      active && loop(positions)
    }, loopDelay)
  }

  this.on('message', data => {
    const message = JSON.parse(data)
    switch (message.type) {
      case 'resume': {
        layerId = message.id
        active = true
        loop([
          randomPosition(59.436962, 24.753574),
          randomPosition(59.436962, 24.753574),
          randomPosition(59.436962, 24.753574)
        ])
        break
      }
      case 'suspend': {
        active = false
        break
      }
    }
  })
}

const signalBeam = function () {
  var layerId
  var active = true

  const loop = bearing => {
    const xs = [
      ['Tallinn', [24.753574, 59.436962], 'cyan'], // [Longitude, Latitude]
      ['Tartu', [26.728493, 58.378025], 'magenta'],
      ['Pärnu', [24.49711, 58.38588], 'black']
    ]

    const distance = 200 * 1000 // [m]

    setTimeout(() => {
      const features = xs.map((x, index) => {
        const point = new LatLon(x[1][1], x[1][0]).destinationPoint(distance, bearing * (index + 1))
        return {
          type: 'Feature',
          id: `feature:${layerId.split(':')[1]}/${beamUUIDs[index]}`,
          geometry: { type: "LineString", coordinates: [
            x[1],
            [point.lng, point.lat]
          ]},
          properties: {
            t: `${x[0]} Lighthouse`,
            color: x[2]
          }
        }
      })

      const collection = { type: 'FeatureCollection', features }
      this.send(JSON.stringify(collection))
      active && loop((bearing + 1) % 360)
    }, 50)
  }

  this.on('message', data => {
    const message = JSON.parse(data)
    switch (message.type) {
      case 'resume': {
        layerId = message.id
        active = true
        loop(0)
        break
      }
      case 'suspend': {
        active = false
        break
      }
    }
  })
}

const handlers = [
  featureHandler,
  collectionHandler,
  signalBeam
]


wss.on('connection', socket => {
  console.log('connection accepted.')
  socket.alive = true
  socket.on('pong', heartbeat)
  // socket.handler = handlers[Math.floor(Math.random() * handlers.length)].bind(socket)
  socket.handler = handlers[2].bind(socket)
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
