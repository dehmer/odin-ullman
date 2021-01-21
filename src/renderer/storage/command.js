import * as R from 'ramda'
import uuid from 'uuid-random'
import * as geom from 'ol/geom'
import DateTime from 'luxon/src/datetime'
import * as level from './level'
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

emitter.on('layers/import', async ({ layers }) => {

  // Overwrite existing layers, i.e. delete before re-adding.
  const names = layers.map(R.prop('name'))
  const loaded = await level.getItems('layer:')
  const removals = loaded.filter(layer => names.includes(layer.name))

  const ops = await removals.reduce(async (accp, layer) => {
    const acc = await accp
    acc.push({ type: 'del', key: layer.id })
    const featureIds = await level.keys(`feature:${layer.id.split(':')[1]}`)
    acc.push(...featureIds.map(key => ({ type: 'del', key })))
    return acc
  }, [])

  // Put new layers/features:
  layers.reduce((acc, layer) => {
    layer.id = layerId()
    const features = layer.features
    delete layer.features
    delete layer.type
    acc.push({ type: 'put', key: layer.id, value: layer })

    const ops = features
      .map(R.tap(feature => feature.id = featureId(layer.id)))
      .map(value => ({ type: 'put', key: value.id, value }))

    acc.push(...ops)
    return acc
  }, ops)

  level.batch(ops)
})

const contained = async (accp, id) => {
  const acc = await accp

  if (isFeature(id)) {
    const item = await level.getItem(id)
    return acc.concat(item)
  } else if (isGroup(id)) {
    const item = await level.getItem(id)
    const ids = searchIndex(item.terms)
      .filter(({ ref }) => !isGroup(ref) && !isSymbol(ref))
      .map(({ ref }) => ref)
    return ids.reduce(contained, acc)
  } else if (isLayer(id)) {
    acc.push(await level.getItem(id))
    const ids = await level.keys(`feature:${id.split(':')[1]}`)
    return ids.reduce(contained, acc)
  } else return acc
}

emitter.on(':id(.*)/show', async ({ id }) => {
  const ids = R.uniq([id, ...selection.selected()])
  const ops = (await ids.reduce(contained, []))
    .map(R.tap(item => delete item.hidden))
    .reduce((acc, item) => acc.concat({ type: 'put', key: item.id, value: item }), [])

  level.batch(ops)
})

emitter.on(':id(.*)/hide', async ({ id }) => {
  const ids = R.uniq([id, ...selection.selected()])
  const ops = (await ids.reduce(contained, []))
    .map(R.tap(item => (item.hidden = true)))
    .reduce((acc, item) => acc.concat({ type: 'put', key: item.id, value: item }), [])

  level.batch(ops)
})


const rename = async ({ id, name }) => {
  const item = await level.getItem(id)
  item.name = name.trim()
  level.setItem(item)
}

emitter.on(`:id(${LAYER_ID})/rename`, rename)
emitter.on(`:id(${GROUP_ID})/rename`, rename)


/**
 *
 */
emitter.on(`:id(${FEATURE_ID})/rename`, async ({ id, name }) => {
  const feature = await level.getItem(id)
  feature.properties.t = name.trim()
  level.setItem(feature)
})


/**
 *
 */
emitter.on(`:id(${PLACE_ID})/rename`, async ({ id, name }) => {
  const place = await level.getItem(id)
  place.name = name.trim()
  place.sticky = true
  level.setItem(place)
})


/**
 *
 */
emitter.on('items/remove', async ({ ids }) => {
  const uniqueIds = R.uniq(ids.filter(R.identity))

  const loadItems = async (ids, acc) => {
    if (!ids) return acc
    const ps = ids.filter(id => !acc[id]).map(level.getItem)
    const items = await Promise.all(ps)

    return items.reduce(async (pacc, item) => {
      const acc = await pacc
      acc[item.id] = item
      if (isLink(item.id)) await loadItems([item.ref], acc)
      else if (isLayer(item.id)) {
        const featureIds = await level.keys(`feature:${item.id.split(':')[1]}`)
        await loadItems(featureIds, acc)
        await loadItems(item.links, acc)
      } else if (isFeature(item.id)) await loadItems(item.links, acc)
      return acc
    }, acc)
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

  const items = await loadItems(uniqueIds, {})
  const ops = {}
  uniqueIds.forEach(remove(items, ops))
  level.batch(Object.entries(ops).map(([key, value]) => ({ ...value, key })))
})


/**
 *
 */
emitter.on('storage/group', async () => {
  const search = await level.getItem('search:')
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

  const group = {
    id: `group:${uuid()}`,
    name: (fields.text || []).join(' ') || 'N/A',
    terms,
    ...fields
  }

  level.batch([{ type: 'put', key: group.id, value: group }])
})


/**
 *
 */
emitter.on('storage/bookmark', async () => {
  const view = await level.getItem('session:map.view')
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

  level.batch([{ type: 'put', key: item.id, value: item }])
  emitter.emit('search/scope/place')
  selection.set([item.id])
})


/**
 *
 */
emitter.on('search/current', ({ terms }) => {
  level.setItem({ id: 'search:', terms }, true)
})


/**
 *
 */
emitter.on(`:id(${FEATURE_ID})/links/add`, async ({ id, files }) => {
  const feature = await level.getItem(id)

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

  level.batch(ops)
})


/**
 *
 */
emitter.on(`:id(${LAYER_ID})/links/add`, async ({ id, files }) => {
  const layer = await level.getItem(id)

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
  level.batch(ops)
})


/**
 *
 */
emitter.on('storage/features/add', async ({ feature }) => {
  const ops = []

  const defaultLayer = async () => {
    const isDefault = layer => (layer.tags || []).includes('default')
    const xs = (await level.getItems('layer:')).filter(isDefault)

    if (xs.length) return xs[0]
    else {
      const layer = {
        id: `layer:${uuid()}`,
        name: `Layer - ${currentDateTime()}`,
        tags: ['default']
      }

      ops.push({ type: 'put', key: layer.id, value: layer })
      return layer
    }
  }

  const layer = await defaultLayer()
  if (!layer) return
  const item = writeFeatureObject(feature)
  item.id = featureId(layer.id)
  ops.push({ type: 'put', key: item.id, value: item })
  level.batch(ops)
})


/**
 *
 */
emitter.on('features/geometry/update', async ({ geometries }) => {
  const ops = await Object.entries(geometries).reduce(async (acc, [id, geometry]) => {
    const feature = await level.getItem(id)
    feature.geometry = writeGeometryObject(geometry)
    return (await acc).concat({ type: 'put', key: id, value: feature })
  }, [])

  level.batch(ops)
})


/**
 * Create new layer from last search.
 */
emitter.on('storage/layer', async () => {
  const pid = layerId()
  const item = await level.getItem('search:')
  const ids = searchIndex(item.terms)
    .filter(({ ref }) => !isGroup(ref) && !isSymbol(ref))
    .map(({ ref }) => ref)

  const items = await ids.reduce(async function reducer (accp, id) {
    const acc = await accp
    if (isLayer(id)) {
      const featureIds = await level.keys(`feature:${id.split(':')[1]}`)
      return featureIds.reduce(reducer, acc)
    } else if (isPlace(id)) {
      const place = await level.getItem(id)
      return acc.concat({
        type: 'Feature',
        geometry: place.geojson,
        properties: { t: place.name },
        id: featureId(pid),
        tags: place.tags
      })
    } else if (isFeature(id)) {
      const feature = { ...(await level.getItem(id)), id: featureId(pid) }
      return acc.concat(feature)
    }
    else return acc
  }, [])

  const layer = {
    id: pid,
    name: `Layer - ${currentDateTime()}`,
    tags: R.uniq(items.flatMap(R.prop('tags'))).filter(R.identity)
  }

  const ops = items.concat(layer).map(item => ({ type: 'put', key: item.id, value: item}))
  level.batch(ops)
  emitter.emit('search/scope/layer')
  selection.set([pid])
})


// <- command handlers
