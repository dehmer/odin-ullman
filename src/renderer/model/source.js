/* eslint-disable import/no-duplicates */
import Collection from 'ol/Collection'
import Feature from 'ol/Feature'
import VectorSource from 'ol/source/Vector'
import uuid from 'uuid-random'
import { storage } from '../storage'
import { featureId } from '../storage/ids'
import { isFeature } from '../storage/ids'
import emitter from '../emitter'
import selection from '../selection'
import { readFeature, writeFeaturesObject } from '../storage/format'
import { currentDateTime } from './datetime'

// -> OpenLayers interface (ol/source/Vector)

export const features = new Collection()
export const source = new VectorSource()

const featureById = id => source.getFeatureById(id)

/**
 * removeFeature :: ol/Feature | string -> unit
 */
const removeFeature = x => {
  if (!x) return
  if (x instanceof Feature) source.removeFeature(x)
  else if (typeof x === 'string') removeFeature(featureById(x))
  else removeFeature(x.id)
}

const addFeature = x => {
  if (!x || x.hidden || !isFeature(x.id)) return
  source.addFeature(readFeature(x))
}

const addFeatures = xs => source.addFeatures(xs)
const isVisible = feature => feature && !feature.hidden


/**
 * Initial population.
 */
;(() => {
  const features = storage.keys()
    .filter(isFeature)
    .map(storage.getItem)
    .filter(isVisible)
    .map(readFeature)

  addFeatures(features)
})()


/**
 *
 */
emitter.on('storage/updated', changes => {
  selection.deselect(changes.removal)
  changes.removal.forEach(removeFeature)
  changes.update.forEach(removeFeature)

  // TODO: bulk - addFeatures()
  changes.update.forEach(addFeature)
  changes.addition.forEach(addFeature)
})


/**
 *
 */
emitter.on('storage/batch', ({ ops }) => {
  const removals = ops.filter(op => op.type === 'del').map(op => op.key)
  const additions = ops.filter(op => op.type === 'put').map(op => op.value)
  selection.deselect(removals)
  removals.forEach(removeFeature)
  additions.forEach(removeFeature)
  additions.forEach(addFeature) // TODO: bulk - addFeatures()
})


/**
 *
 */
emitter.on('storage/put', ({ key, value }) => {
  if (!isFeature(key)) return
  removeFeature(value)
  addFeature(value)
})


/**
 *
 */
emitter.on('storage/snapshot', () => {
  const layer = writeFeaturesObject(source.getFeatures())
  layer.id = `layer:${uuid()}`
  layer.name = `Snapshot - ${currentDateTime()}`
  layer.tags = ['snapshot']

  const featureCollection = layer.features
  delete layer.features

  const ops = featureCollection.map(feature => {
    feature.id = featureId(layer.id)
    feature.hidden = true
    return { type: 'put', key: feature.id, value: feature }
  })

  ops.push({ type: 'put', key: layer.id, value: layer })
  emitter.emit('search/scope/layer')
  storage.batch(ops)
  selection.set([layer.id])
})

// <- OpenLayers interface (ol/source/Vector)
