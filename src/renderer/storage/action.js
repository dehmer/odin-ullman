import * as R from 'ramda'
import Collection from 'ol/Collection'
import Feature from 'ol/Feature'
import { getCenter } from 'ol/extent'
import * as level from './level'
import emitter from '../emitter'
import { isGroup, isSymbol } from './ids'
import { FEATURE_ID, LAYER_ID, PLACE_ID, GROUP_ID, SYMBOL_ID } from './ids'
import { all } from '../model/options'
import { searchIndex } from '../search/lunr'
import { readGeometry, readFeature } from './format'
import selection from '../selection'
import geometry from './geometry'

export const highlightedFeatures = new Collection()


emitter.on(`:id(${LAYER_ID})/open`, async ({ id }) => {
  const layer = await level.value(id)

  const features = async () => {
    const ids = await level.keys(`feature:${id.split(':')[1]}`)
    return all(ids)
  }

  emitter.emit('search/provider', {
    scope: layer.name,
    provider: async (query, callback) => callback(await features())
  })
})

emitter.on(`:id(${GROUP_ID})/open`, async ({ id }) => {
  const group = await level.value(id)

  const options = () => {
    const ids = searchIndex(group.terms)
      .filter(({ ref }) => !isGroup(ref) && !isSymbol(ref))
      .map(R.prop('ref'))
    return all(ids)
  }

  emitter.emit('search/provider', {
    scope: group.name,
    provider: async (query, callback) => callback(await options())
  })
})

emitter.on(`:id(${PLACE_ID})/panto`, async ({ id }) => {
  const item = await level.value(id)
  const geometry = readGeometry(item.geojson)
  const extent = geometry.getExtent()
  const center = getCenter(extent)
  emitter.emit('map/panto', { center, resolution: item.resolution })
})

emitter.on(`:id(${FEATURE_ID})/panto`, async ({ id }) => {
  const item = await level.value(id)
  const geometry = readFeature(item).getGeometry()
  const center = getCenter(geometry.getExtent())
  emitter.emit('map/panto', { center })
})

emitter.on(`:id(${LAYER_ID})/panto`, async ({ id }) => {
  const extent = (await geometry(id)).getExtent()
  const center = getCenter(extent)
  emitter.emit('map/panto', { center })
})

emitter.on(':id(.*)/identify/down', async ({ id }) => {
  const ids = R.uniq([id, ...selection.selected()])
  const geometries = await Promise.all(ids.map(geometry))
  geometries
    .filter(R.identity)
    .forEach(geometry => highlightedFeatures.push(new Feature({ geometry })))
})

emitter.on(':dontcare(.*)/identify/up', () => {
  highlightedFeatures.clear()
})

emitter.on(`:id(${FEATURE_ID})/links`, async ({ id }) => {
  const feature = await level.value(id)
  const links = async () => {
    const feature = await level.value(id)
    const links = await all(feature.links || [])
    return Promise.all(links)
  }

  emitter.emit('search/provider', {
    scope: feature.properties.t,
    provider: async (query, callback) => callback(await links())
  })
})

emitter.on(`:id(${LAYER_ID})/links`, async ({ id }) => {
  const layer = await level.value(id)
  const links = async () => {
    const layer = await level.value(id)
    const links = await all(layer.links || [])
    return Promise.all(links)
  }

  emitter.emit('search/provider', {
    scope: layer.name,
    provider: async (query, callback) => callback(await links())
  })
})

emitter.on(`:id(${SYMBOL_ID})/draw`, async ({ id }) => {
  const descriptor = await level.value(id)
  const sidc = descriptor.sidc
  descriptor.sidc = `${sidc[0]}F${sidc[2]}P${sidc.substring(4)}`
  if (descriptor) emitter.emit('map/draw', { descriptor })
})
