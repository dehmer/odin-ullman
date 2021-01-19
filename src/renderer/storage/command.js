import * as R from 'ramda'
import uuid from 'uuid-random'
import * as geom from 'ol/geom'
import DateTime from 'luxon/src/datetime'
import { storage } from '.'
import { layerId, featureId } from './ids'
import { isLayer, isFeature, isGroup, isSymbol, isPlace, isLink } from './ids'
import { FEATURE_ID, LAYER_ID, PLACE_ID, GROUP_ID } from './ids'
import emitter from '../emitter'
import { searchIndex } from '../search/lunr'
import { writeGeometryObject, writeFeatureObject } from './format'
import selection from '../selection'
import { currentDateTime, toMilitaryTime } from '../model/datetime'
import './command-tag'


// -> command handlers

emitter.on('layers/import', ({ layers }) => {

  // Overwrite existing layers, i.e. delete before re-adding.
  const names = layers.map(R.prop('name'))
  const layerIds = storage.keys('layer:')
  const featureIds = storage.keys('feature:')

  const removals = layerIds
    .map(storage.getItem)
    .filter(layer => names.includes(layer.name))
    .map(layer => layer.id)

  featureIds.reduce((acc, featureId) => {
    if (acc.includes(layerId(featureId))) acc.push(featureId)
    return acc
  }, removals)

  const ops = removals.map(id => ({ type: 'del', key: id }))

  layers.reduce((acc, layer) => {
    layer.id = layerId()
    const features = layer.features
    delete layer.features
    delete layer.type
    acc.push({ type: 'put', key: layer.id, value: layer })

    features.forEach(feature => {
      feature.id = featureId(layer.id)
      acc.push({ type: 'put', key: feature.id, value: feature })
    })

    return acc
  }, ops)

  storage.batch(ops)
})

const contained = (() => {
  const groupIds = id => searchIndex(storage.getItem(id).terms)
    .filter(({ ref }) => !isGroup(ref) && !isSymbol(ref))
    .map(({ ref }) => ref)

  const array = ids => ids.reduce((acc, id) => acc.concat([id, ...contained(id)]), [])
  const layer = id => storage.keys().filter(cid => layerId(cid) === id)
  const group = id => contained(groupIds(id))

  return R.cond([
    [R.is(Array), array],
    [isLayer, layer],
    [isGroup, group],
    [R.T, id => [id]]
  ])
})()

emitter.on(':id(.*)/show', ({ id }) => {
  const ids = R.uniq([id, ...selection.selected()])
  const ops = ids.flatMap(id => contained(id))
    .map(storage.getItem)
    .map(R.tap(item => delete item.hidden))
    .reduce((acc, item) => acc.concat({ type: 'put', key: item.id, value: item }), [])

  storage.batch(ops)
})

emitter.on(':id(.*)/hide', ({ id }) => {
  const ops = R.uniq([id, ...selection.selected()])
    .flatMap(id => contained(id))
    .map(storage.getItem)
    .map(R.tap(item => (item.hidden = true)))
    .reduce((acc, item) => acc.concat({ type: 'put', key: item.id, value: item }), [])

  storage.batch(ops)
})

emitter.on(`:id(${LAYER_ID})/suspend`, ({ id }) => {
  const socket = storage.getItem(id)
  socket.active = false
  storage.setItem(socket)
})

emitter.on(`:id(${LAYER_ID})/resume`, ({ id }) => {
  const socket = storage.getItem(id)
  socket.active = true
  storage.setItem(socket)
})

const rename = async ({ id, name }) => {
  const item = await storage.getItem(id)
  item.name = name.trim()
  storage.setItem(item)
}

emitter.on(`:id(${LAYER_ID})/rename`, rename)
emitter.on(`:id(${GROUP_ID})/rename`, rename)


/**
 *
 */
emitter.on(`:id(${FEATURE_ID})/rename`, async ({ id, name }) => {
  const feature = await storage.getItem(id)
  feature.properties.t = name.trim()
  storage.setItem(feature)
})


/**
 *
 */
emitter.on(`:id(${PLACE_ID})/rename`, async ({ id, name }) => {
  const place = await storage.getItem(id)
  place.name = name.trim()
  place.sticky = true
  storage.setItem(place)
})


/**
 *
 */
emitter.on('items/remove', ({ ids }) => {

  const load = acc => id => {
    if (!id) return acc
    if (acc[id]) return acc

    acc[id] = storage.getItem(id)
    if (isLink(id)) load(acc)(acc[id].ref)
    else if (isLayer(id)) {
      storage.keys()
        .filter(cid => isFeature(cid) && layerId(cid) === id)
        .forEach(load(acc))
    } else if (isFeature(id)) {
      (acc[id].links || []).forEach(load(acc))
    }
  }

  const remove = (items, ops) => id => {
    if (!items[id]) return /* should not happen */

    if (isLink(id)) {
      const link = items[id]
      const ref = items[link.ref]
      if (!ref) return /* already gone */
      ref.links = ref.links.filter(lid => lid !== id)
      if (ref.links.length === 0 && isFeature(ref.id)) {
        ref.properties.g = ref.properties.g.replace(/►/g, '').trim()
      }

      ops[ref.id] = { type: 'put', value: ref }
    } else if (isLayer(id)) {
      Object.keys(items)
        .filter(cid => isFeature(cid) && layerId(cid) === id)
        .forEach(remove(items, ops))

      ;(items[id].links || []).forEach(remove(items, ops))
    } else if (isFeature(id)) {
      (items[id].links || []).forEach(remove(items, ops))
    }

    ops[id] = { type: 'del' }
  }

  const uniqueIds = R.uniq(ids.filter(R.identity))
  const items = {}
  const ops = {}
  uniqueIds.forEach(load(items))
  uniqueIds.forEach(remove(items, ops))
  storage.batch(Object.entries(ops).map(([key, value]) => ({ ...value, key })))
})


/**
 *
 */
emitter.on('storage/group', async () => {
  const search = await storage.getItem('search:')
  if (!search) return
  const { terms } = search

  const fields = terms.split(' ')
    .filter(R.identity)
    .map(part => R.drop(1, (/\+?(\w+):(\w+)/g).exec(part)))
    .reduce((acc, tuple) => {
      acc[tuple[0]] = acc[tuple[0]] || []
      acc[tuple[0]].push(tuple[1])
      return acc
    }, {})

  const id = `group:${uuid()}`
  const name = (fields.text || []).join(' ') || 'N/A'
  storage.setItem({ id, name, terms, ...fields })
})


/**
 *
 */
emitter.on('storage/bookmark', async () => {
  const view = await storage.getItem('session:map.view')
  if (!view) return

  const point = new geom.Point(view.center)
  const item = {
    id: `place:${uuid()}`,
    display_name: 'Bookmark',
    name: 'Bookmark',
    class: 'bookmark',
    type: 'boundary',
    sticky: true,
    geojson: writeGeometryObject(point),
    resolution: view.resolution
  }

  storage.setItem(item)
  emitter.emit('search/scope/place')
  selection.set([item.id])
})


/**
 *
 */
emitter.on('storage/layer', () => {
  const features = pid => id => {
    if (isPlace(id)) {
      const place = storage.getItem(id)
      return {
        id: featureId(pid),
        type: 'Feature',
        geometry: place.geojson,
        properties: { t: place.name },
        tags: place.tags
      }
    } else return []
  }

  const item = storage.getItem('search:')
  const ids = searchIndex(item.terms)
    .filter(({ ref }) => !isGroup(ref) && !isSymbol(ref))
    .map(({ ref }) => ref)

  const pid = layerId()
  const items = R.uniq(contained(ids)).flatMap(features(pid))
  const tags = R.uniq(items.flatMap(R.prop('tags')))
  storage.setItem({ id: pid, name: `Layer - ${currentDateTime()}`, tags })
  items.forEach(storage.setItem)

  emitter.emit('search/scope/layer')
  selection.set([pid])
})

emitter.on('storage/socket', () => {
  console.log('[storage/socket]')
  const layer = {
    id: layerId(),
    name: `Socket Layer - ${currentDateTime()}`,
    type: 'socket',
    url: 'ws://localhost:3000',
    active: true
  }

  storage.setItem(layer)
  emitter.emit('search/scope/layer')
  selection.set([layer.id])
})

/**
 *
 */
emitter.on('search/current', ({ terms }) => {
  storage.setItem({ id: 'search:', terms }, true)
})


/**
 *
 */
emitter.on(`:id(${FEATURE_ID})/links/add`, async ({ id, files }) => {
  const feature = await storage.getItem(id)

  const links = files.map(file => ({
    id: `link:${uuid()}`,
    ref: id,
    container: feature.properties.t,
    name: file.name,
    lastModifiedDate: toMilitaryTime(DateTime.fromJSDate(file.lastModifiedDate)),
    type: file.type
  }))

  const ops = links.map(link => ({ type: 'put', key: link.id, value: link }))

  const appendMarker = s => s ? `${s} ►` : '►'
  const properties = feature.properties
  if (!feature.links || feature.links.length === 0) properties.g = appendMarker(properties.g)
  feature.links = [...(feature.links || []), ...links.map(link => link.id)]
  ops.push({ type: 'put', key: id, value: feature })


  storage.batch(ops)
})


/**
 *
 */
emitter.on(`:id(${LAYER_ID})/links/add`, ({ id, files }) => {
  const layer = storage.getItem(id)

  const links = files.map(file => ({
    id: `link:${uuid()}`,
    ref: id,
    container: layer.name,
    name: file.name,
    lastModifiedDate: toMilitaryTime(DateTime.fromJSDate(file.lastModifiedDate)),
    type: file.type
  }))

  const ops = links.map(link => ({ type: 'put', key: link.id, value: link }))
  layer.links = [...(layer.links || []), ...links.map(link => link.id)]
  ops.push({ type: 'put', key: id, value: layer })
  storage.batch(ops)
})


/**
 *
 */
emitter.on('storage/features/add', ({ feature }) => {
  const ops = []

  const findLayer = () => storage.keys('layer:')
    .map(storage.getItem)
    .find(layer => (layer.tags || []).includes('default'))

  const createLayer = () => {
    const item = {
      id: `layer:${uuid()}`,
      name: `Layer - ${currentDateTime()}`,
      tags: ['default']
    }

    ops.push({ type: 'put', key: item.id, value: item })
    return item
  }

  const layer = findLayer() || createLayer()

  if (!layer) return
  const item = writeFeatureObject(feature)
  item.id = featureId(layer.id)
  ops.push({ type: 'put', key: item.id, value: item })
  storage.batch(ops)
})


/**
 *
 */
emitter.on('features/geometry/update', ({ geometries }) => {
  const ops = Object.entries(geometries).reduce((acc, [id, geometry]) => {
    const feature = storage.getItem(id)
    feature.geometry = writeGeometryObject(geometry)
    return acc.concat({ type: 'put', key: id, value: feature })
  }, [])

  storage.batch(ops)
})

/**
 *
 */
emitter.on(`:id(${FEATURE_ID})/follow`, ({ id }) => {
  const feature = storage.getItem(id)
  if (feature.follow) {
    delete feature.follow
    const ops = [{ type: 'put', key: id, value: feature }]
    storage.batch(ops)
  } else {
    feature.follow = true
    const ops = storage.keys()
      .filter(isFeature)
      .map(storage.getItem)
      .filter(feature => feature.follow)
      .map(R.tap(feature => delete feature.follow))
      .map(feature => ({ type: 'put', key: feature.id, value: feature }))
    ops.push({ type: 'put', key: id, value: feature })
    storage.batch(ops)
  }
})

// <- command handlers
