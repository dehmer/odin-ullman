/* eslint-disable import/no-duplicates */
import * as R from 'ramda'
import Collection from 'ol/Collection'
import Feature from 'ol/Feature'
import { getCenter } from 'ol/extent'
import { storage } from '.'
import emitter from '../emitter'
import { isFeature, isGroup, isSymbol } from './ids'
import { FEATURE_ID, LAYER_ID, PLACE_ID, GROUP_ID, SYMBOL_ID } from './ids'
import { isContained, getItem } from './helpers'
import { options } from '../model/options'
import { searchIndex } from '../search/lunr'
import { readGeometry, readFeature } from './format'
import selection from '../selection'
import geometry from './geometry'

const option = id => options[id.split(':')[0]](id)
export const highlightedFeatures = new Collection()

emitter.on(`:id(${LAYER_ID})/open`, ({ id }) => {
  const layer = getItem(id)
  const features = () => storage.keys()
    .filter(isContained(id))
    .filter(isFeature)
    .map(option)

  emitter.emit('search/provider', {
    scope: layer.name,
    provider: (query, callback) => callback(features())
  })
})

emitter.on(`:id(${GROUP_ID})/open`, ({ id }) => {
  const group = getItem(id)
  const options = () => searchIndex(group.terms)
    .filter(({ ref }) => !isGroup(ref))
    .filter(({ ref }) => !isSymbol(ref))
    .map(({ ref }) => ref)
    .map(option)

  emitter.emit('search/provider', {
    scope: group.name,
    provider: (query, callback) => callback(options())
  })
})

emitter.on(`:id(${PLACE_ID})/panto`, ({ id }) => {
  const item = storage.getItem(id)
  const geometry = readGeometry(item.geojson)
  const extent = geometry.getExtent()
  const center = getCenter(extent)
  emitter.emit('map/panto', { center, resolution: item.resolution })
})

emitter.on(`:id(${FEATURE_ID})/panto`, ({ id }) => {
  const item = storage.getItem(id)
  const geometry = readFeature(item).getGeometry()
  const center = getCenter(geometry.getExtent())
  emitter.emit('map/panto', { center })
})

emitter.on(`:id(${LAYER_ID})/panto`, ({ id }) => {
  const center = getCenter(geometry(id).getExtent())
  emitter.emit('map/panto', { center })
})

emitter.on(':id(.*)/identify/down', ({ id }) => {

  R.uniq([id, ...selection.selected()])
    .map(geometry)
    .filter(R.identity)
    .forEach(geometry => highlightedFeatures.push(new Feature({ geometry })))
})

emitter.on(':dontcare(.*)/identify/up', () => {
  highlightedFeatures.clear()
})

emitter.on(`:id(${FEATURE_ID})/links`, ({ id }) => {
  const feature = storage.getItem(id)
  const links = () => (storage.getItem(id).links || []).map(option)
  emitter.emit('search/provider', {
    scope: feature.properties.t,
    provider: (query, callback) => callback(links())
  })
})

emitter.on(`:id(${LAYER_ID})/links`, ({ id }) => {
  const layer = storage.getItem(id)
  const links = () => (storage.getItem(id).links || []).map(option)
  emitter.emit('search/provider', {
    scope: layer.name,
    provider: (query, callback) => callback(links())
  })
})

emitter.on(`:id(${SYMBOL_ID})/draw`, ({ id }) => {
  const descriptor = storage.getItem(id)
  const sidc = descriptor.sidc
  descriptor.sidc = `${sidc[0]}F${sidc[2]}P${sidc.substring(4)}`
  if (descriptor) emitter.emit('map/draw', { descriptor })
})
