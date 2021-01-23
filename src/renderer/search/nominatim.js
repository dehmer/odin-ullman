import * as R from 'ramda'
import * as level from '../storage/level'
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
  xhr.addEventListener('readystatechange', async event => {
    const request = event.target

    switch (request.readyState) {
      case DONE: {
        try {
          const isNotSticky = place => !place.sticky
          const removals = (await level.values('place:')).filter(isNotSticky)
          const ops = removals.map(place => ({ type: 'del', key: place.id }))

          JSON.parse(request.responseText)
            .reduce((acc, entry) => {
              const item = place(entry)
              acc.push({ type: 'put', key: item.id, value: item})
              return acc
            }, ops)

          level.batch(ops)
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
