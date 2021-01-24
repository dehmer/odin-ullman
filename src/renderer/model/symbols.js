import ms from 'milsymbol'
import json from './symbols.json'
import { normalize } from './sidc'
import * as level from '../storage/level'

const id = descriptor => `symbol:${descriptor.sidc.substring(0, 10)}`

const symbols = json.reduce((acc, symbol) => {
  symbol.dimensions = symbol.dimension ? symbol.dimension.split(', ') : []
  symbol.scope = symbol.scope ? [symbol.scope] : []
  delete symbol.dimension
  acc[normalize(symbol.sidc)] = symbol
  return acc
}, {})

;(async () => {
  if (await level.exists('symbol:')) return

  // Populate storage with symbols if missing:
  level.batch(Object.values(symbols).map(symbol => {
    symbol.id = id(symbol)
    return { type: 'put', key: symbol.id, value: symbol }
  }))
})()

export const hierarchy = sidc => {
  if (!sidc) return ['N/A']
  const descriptor = symbols[normalize(sidc)]
  return descriptor ? descriptor.hierarchy : ['N/A']
}

export const dimensions = sidc => {
  if (!sidc) return []
  const symbol = symbols[normalize(sidc)]
  return symbol ? symbol.dimensions : []
}

export const scope = sidc => {
  if (!sidc) return []
  const symbol = symbols[normalize(sidc)]
  return symbol ? symbol.scope : []
}

const placeholderSymbol = new ms.Symbol('')

const cache = {
  _: placeholderSymbol.asCanvas().toDataURL()
}

export const url = sidc => {
  if (!cache[sidc]) {
    const symbol = new ms.Symbol(sidc)
    if (!symbol.isValid()) return cache._
    cache[sidc] = symbol.asCanvas().toDataURL()
  }

  return cache[sidc]
}

export const layout = feature => {
  if (!feature) return
  if (!feature.get('sidc')) return
  const sidc = feature.get('sidc')
  const descriptor = symbols[normalize(sidc)]
  return descriptor
    ? descriptor.parameters && descriptor.parameters.layout
      ? `${descriptor.geometry}-${descriptor.parameters.layout}`
      : `${descriptor.geometry}`
    : undefined
}

export const maxPoints = sidc => {
  const descriptor = symbols[normalize(sidc)]
  return descriptor
    ? descriptor.parameters && descriptor.parameters.maxPoints
    : undefined
}

// <- Symbol URL and cache
