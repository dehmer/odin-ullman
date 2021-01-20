import * as R from 'ramda'
import { isLayer, isFeature, isGroup, isSymbol, isPlace } from './ids'
import { readGeometry, readFeature } from './format'
import * as level from './level'
import { searchIndex } from '../search/lunr'
import * as TS from '../map/ts'


/**
 *
 */
const layer = async id => {
  const features = await level.getItems(`feature:${id.split(':')[1]}`)
  const geometries = features
    .map(readFeature)
    .map(feature => feature.getGeometry())
    .map(TS.read)
  const collection = TS.collect(geometries)
  return TS.write(TS.minimumRectangle(collection))
}


/**
 *
 */
const feature = async id => {
  const item = await level.getItem(id)
  const feature = readFeature(item)
  const geometry = TS.read(feature.getGeometry())
  const bounds = feature.getGeometry().getType() === 'Polygon'
    ? geometry
    : TS.minimumRectangle(geometry)
  return TS.write(bounds)
}


/**
 *
 */
const place = async id => {
  const item = await level.getItem(id)
  return readGeometry(item.geojson)
}


/**
 *
 */
const group = async id => {
  const item = await level.getItem(id)

  const items = (await Promise.all(searchIndex(item.terms)
    .filter(({ ref }) => !isGroup(ref) && !isSymbol(ref))
    .map(({ ref }) => ref)
    .filter(id => isLayer(id) || isFeature(id) || isPlace(id))
    .flatMap(id => isLayer(id)
      ? level.getItems(`feature:${id.split(':')[1]}`)
      : level.getItem(id)
    )
  )).flat()

  const extractGeometry = item => isPlace(item.id)
    ? readGeometry(item.geojson)
    : readFeature(item).getGeometry()

  const geometries = items.map(extractGeometry)
    .filter(R.identity)
    .map(TS.read)

  const collection = TS.collect(geometries)
  return collection.getNumGeometries()
    ? TS.write(TS.minimumRectangle(collection))
    : null
}

/**
 *
 */
export default R.cond([
  [isLayer, layer],
  [isFeature, feature],
  [isPlace, place],
  [isGroup, group],
  [R.T, R.always(null)]
])
