import Feature from 'ol/Feature'
import ms from 'milsymbol'
import json from './symbols.json'
import { normalize, identity } from './sidc'

export const symbols = json.reduce((acc, symbol) => {
  symbol.dimensions = symbol.dimension ? symbol.dimension.split(', ') : []
  symbol.scope = symbol.scope ? [symbol.scope] : []
  delete symbol.dimension
  acc[normalize(symbol.sidc)] = symbol
  return acc
}, {})

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

export const meta = feature => {
  const sidc = feature instanceof Feature
    ? feature.get('sidc')
    : feature.properties.sidc

  if (!sidc) return {}
  return {
    scope: scope(sidc),
    dimensions: dimensions(sidc),
    hierarchy: hierarchy(sidc),
    identity: identity(sidc)
  }
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
