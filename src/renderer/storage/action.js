import * as R from 'ramda'
import Collection from 'ol/Collection'
import Feature from 'ol/Feature'
import { getCenter } from 'ol/extent'
import * as level from './level'
import emitter from '../emitter'
import { isGroup, layerId, isLayer, isFeature } from './ids'
import { FEATURE_ID, LAYER_ID, PLACE_ID, GROUP_ID, SYMBOL_ID, LINK_ID } from './ids'
import { lunrProvider } from '../search'
import { readGeometry, readFeature } from './format'
import selection from '../selection'
import geometry from './geometry'

export const highlightedFeatures = new Collection()

emitter.on(`:id(${LAYER_ID})/open`, async ({ id }) => {
  const layer = await level.value(id)
  const filter = async refs => (await refs).filter(ref => layerId(ref) === layer.id)
  emitter.emit('search/provider', {
    scope: layer.name,
    provider: lunrProvider('+scope:feature', filter)
  })
})

emitter.on(`:id(${GROUP_ID})/open`, async ({ id }) => {
  const group = await level.value(id)
  const filter = async refs => (await refs).filter(item => !isGroup(item.id))
  emitter.emit('search/provider', {
    scope: group.name,
    provider: lunrProvider(group.terms, filter)
  })
})

emitter.on(`:id(${PLACE_ID})/panto`, async ({ id }) => {
  const item = await level.value(id)
  const geometry = readGeometry(item.geojson)
  const extent = geometry.getExtent()
  const center = getCenter(extent)
  emitter.emit('map/panto', { center, resolution: item.resolution })
})

const pantoFeature = async ({ id }) => {
  const feature = await level.value(id)
  const geometry = readFeature(feature).getGeometry()
  const center = getCenter(geometry.getExtent())
  emitter.emit('map/panto', { center })
}

const pantoLayer = async ({ id }) => {
  const extent = (await geometry(id)).getExtent()
  const center = getCenter(extent)
  emitter.emit('map/panto', { center })
}

const pantoLink = async ({ id }) => {
  const link = await level.value(id)
  if (isLayer(link.ref)) pantoLayer({ id: link.ref })
  else if (isFeature(link.ref)) pantoFeature(({ id: link.ref }))
}

emitter.on(`:id(${FEATURE_ID})/panto`, pantoFeature)
emitter.on(`:id(${LAYER_ID})/panto`, pantoLayer)
emitter.on(`:id(${LINK_ID})/panto`, pantoLink)

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
  const filter = async refs => (await refs).filter(ref => feature.links.includes(ref.id))
  emitter.emit('search/provider', {
    scope: feature.properties.t,
    provider: lunrProvider('+scope:link', filter)
  })
})

emitter.on(`:id(${LAYER_ID})/links`, async ({ id }) => {
  const layer = await level.value(id)
  const filter = async refs => (await refs).filter(ref => layer.links.includes(ref.id))
  emitter.emit('search/provider', {
    scope: layer.name,
    provider: lunrProvider('+scope:link', filter)
  })
})

emitter.on(`:id(${SYMBOL_ID})/draw`, async ({ id }) => {
  const descriptor = await level.value(id)
  const sidc = descriptor.sidc
  descriptor.sidc = `${sidc[0]}F${sidc[2]}P${sidc.substring(4)}`
  if (descriptor) emitter.emit('map/draw', { descriptor })
})
