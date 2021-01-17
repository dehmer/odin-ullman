import * as R from 'ramda'
import Collection from 'ol/Collection'
import Feature from 'ol/Feature'
import { getCenter } from 'ol/extent'
import { storage } from '.'
import * as level from './level'
import emitter from '../emitter'
import { isGroup, isSymbol } from './ids'
import { FEATURE_ID, LAYER_ID, PLACE_ID, GROUP_ID, SYMBOL_ID } from './ids'
import { options } from '../model/options'
import { searchIndex } from '../search/lunr'
import { readGeometry, readFeature } from './format'
import selection from '../selection'
import geometry from './geometry'

export const highlightedFeatures = new Collection()

const option = id => options[id.split(':')[0]](id)
const getItem = level.getItem


emitter.on(`:id(${LAYER_ID})/open`, async ({ id }) => {
  const layer = await getItem(id)
  const uuid = id.split(':')[1]

  const features = async () => {
    const keys = await level.keys(`feature:${uuid}`)
    return await Promise.all(keys.map(option))
  }

  emitter.emit('search/provider', {
    scope: layer.name,
    provider: async (query, callback) => callback(await features())
  })
})

emitter.on(`:id(${GROUP_ID})/open`, async ({ id }) => {
  const group = await getItem(id)

  const options = async () => {
    const ids = searchIndex(group.terms)
      .filter(({ ref }) => !isGroup(ref) && !isSymbol(ref))
      .map(({ ref }) => ref)
    return await Promise.all(ids.map(option))
  }

  emitter.emit('search/provider', {
    scope: group.name,
    provider: async (query, callback) => callback(await options())
  })
})

emitter.on(`:id(${PLACE_ID})/panto`, ({ id }) => {
  const item = storage.getItem(id)
  const geometry = readGeometry(item.geojson)
  const extent = geometry.getExtent()
  const center = getCenter(extent)
  emitter.emit('map/panto', { center, resolution: item.resolution })
})

emitter.on(`:id(${FEATURE_ID})/panto`, async ({ id }) => {
  const item = await getItem(id)
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

emitter.on(`:id(${FEATURE_ID})/links`, async ({ id }) => {
  const feature = await getItem(id)
  const links = async () => {
    const feature = await getItem(id)
    const links = (feature.links || []).map(option)
    return Promise.all(links)
  }

  emitter.emit('search/provider', {
    scope: feature.properties.t,
    provider: async (query, callback) => callback(await links())
  })
})

emitter.on(`:id(${LAYER_ID})/links`, async ({ id }) => {
  const layer = await getItem(id)
  const links = async () => {
    const layer = await getItem(id)
    const links = (layer.links || []).map(option)
    return Promise.all(links)
  }

  emitter.emit('search/provider', {
    scope: layer.name,
    provider: async (query, callback) => callback(await links())
  })
})

emitter.on(`:id(${SYMBOL_ID})/draw`, ({ id }) => {
  const descriptor = storage.getItem(id)
  const sidc = descriptor.sidc
  descriptor.sidc = `${sidc[0]}F${sidc[2]}P${sidc.substring(4)}`
  if (descriptor) emitter.emit('map/draw', { descriptor })
})
