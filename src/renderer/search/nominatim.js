import * as R from 'ramda'
import { storage } from '../storage'
import emitter from '../emitter'
import uuid from 'uuid-random'

/* eslint-disable */
// XMLHttpRequest.readyState.
const UNSENT           = 0 // Client has been created. open() not called yet.
const OPENED           = 1 // open() has been called.
const HEADERS_RECEIVED = 2 // send() has been called, and headers and status are available.
const LOADING          = 3 // Downloading; responseText holds partial data.
const DONE             = 4 // The operation is complete.
/* eslint-enable */


const options = {
  formal: 'json',
  dedupe: 1,
  polygon_geojson: 1
}

const place = entry => {
  const parts = entry.display_name.split(', ')
  return {
    id: `place:${uuid()}`,
    name: R.head(parts),
    description: R.tail(parts).join(', '),
    ...entry
  }
}

var lastValue = ''
export const searchOSM = query => {
  const { value, mode } = query
  if (!value) return
  if (mode !== 'enter') return
  if (lastValue === value) return

  // Prevent endless recursion: query (explicit) -> model update -> query (implicit).
  lastValue = value

  const xhr = new XMLHttpRequest()
  xhr.addEventListener('readystatechange', event => {
    const request = event.target

    switch (request.readyState) {
      case DONE: {
        try {
          const removal = storage.keys()
            .filter(id => id.startsWith('place'))
            .map(storage.getItem)
            .filter(place => !place.sticky)
            .map(R.prop('id'))

          const addition = JSON.parse(request.responseText)
            .map(place)

          removal.forEach(storage.removeItem)
          addition.forEach(storage.setItem)

          emitter.emit('storage/updated', { addition, removal, update: [] })
        } catch (err) {
          console.error('[nominatim]', err)
        }
      }
    }
  })

  const params = Object.entries(options)
    .reduce((acc, [key, value]) => acc.concat([`${key}=${value}`]), ['format=json'])
    .join('&')

  const url = `https://nominatim.openstreetmap.org/search/${value}?${params}`
  const async = true
  xhr.open('GET', url, async)
  xhr.setRequestHeader('Accept-Language', 'de')
  xhr.send()
}
