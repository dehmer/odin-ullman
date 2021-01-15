import * as R from 'ramda'
import { isLayer, isFeature, isGroup, isSymbol, isPlace } from './ids'
import { getContainedFeatures } from './helpers'
import { readGeometry, readFeature } from './format'
import { storage } from '.'
import { searchIndex } from '../search/lunr'
import * as TS from '../map/ts'

const layer = id => {
  const geometries = getContainedFeatures(id)
    .map(readFeature)
    .map(feature => feature.getGeometry())
    .map(TS.read)
  const collection = TS.collect(geometries)
  return TS.write(TS.minimumRectangle(collection))
}

const feature = id => {
  const item = storage.getItem(id)
  const feature = readFeature(item)
  const geometry = TS.read(feature.getGeometry())
  const bounds = feature.getGeometry().getType() === 'Polygon'
    ? geometry
    : TS.minimumRectangle(geometry)
  return TS.write(bounds)
}

const place = id => {
  const item = storage.getItem(id)
  return readGeometry(item.geojson)
}

const group = id => {
  const item = storage.getItem(id)
  const geometries = searchIndex(item.terms)
    .filter(({ ref }) => !isGroup(ref) && !isSymbol(ref))
    .map(({ ref }) => ref)
    .filter(id => isLayer(id) || isFeature(id) || isPlace(id))
    .flatMap(id => isLayer(id) ? getContainedFeatures(id) : storage.getItem(id))
    .map(item => isPlace(item.id) ? readGeometry(item.geojson) : readFeature(item).getGeometry())
    .map(TS.read)
  const collection = TS.collect(geometries)
  return collection.getNumGeometries()
    ? TS.write(TS.minimumRectangle(collection))
    : null
}

export default R.cond([
  [isLayer, layer],
  [isFeature, feature],
  [isPlace, place],
  [isGroup, group],
  [R.T, R.always(null)]
])
