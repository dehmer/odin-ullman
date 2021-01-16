import * as R from 'ramda'
import uuid from 'uuid-random'
import Feature from 'ol/Feature'

export const layerId = R.cond([
  [R.isNil, () => `layer:${uuid()}`],
  [x => x instanceof Feature, x => layerId(x.getId())],
  // must be a string then...
  [R.startsWith('feature:'), x => `layer:${x.split(':')[1].split('/')[0]}`],
  [R.startsWith('layer:'), R.identity],
  [R.T, x => layerId(x.id)]
])

export const featureId = R.cond([
  [x => x instanceof Feature, x => x.getId()],
  [x => typeof x === 'object', R.prop('id')],
  [R.T, layerId => `feature:${layerId.split(':')[1]}/${uuid()}`]
])

const isId = prefix => id => id.startsWith(prefix)
export const isLayer = isId('layer:')
export const isFeature = isId('feature:')
export const isGroup = isId('group:')
export const isSymbol = isId('symbol:')
export const isPlace = isId('place:')
export const isLink = isId('link:')

export const FEATURE_ID = 'feature:[0-9a-f-]{36}/[0-9a-f-]{36}'
export const LAYER_ID = 'layer:[0-9a-f-]{36}'
export const PLACE_ID = 'place:[0-9a-f-]{36}'
export const GROUP_ID = 'group:[0-9a-f-]{36}'
export const SYMBOL_ID = 'symbol:[A-Z-*]{10}'
export const LINK_ID = 'link:[0-9a-f-]{36}'
