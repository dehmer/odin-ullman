import * as R from 'ramda'
import { defaultStyle } from './default-style'
import { polygonStyle } from './polygon-style'
import { lineStyle } from './line-style'
import { multipointStyle } from './multipoint-style'
import { collectionStyle } from './collection-style'
import { symbolStyle } from './symbol-style'
import cache from 'js-cache'

/**
 * normalizeSIDC :: String -> String
 */
export const normalizeSIDC = sidc => sidc
  ? `${sidc[0]}-${sidc[2]}-${sidc.substring(4, 10)}`
  : 'MUZP------*****'


const cachingProvider = (provider, source) => {
  const cachekey = feature => `${feature.getId()}`
  const styleCache = new cache()

  source.on('removefeature', ({ feature }) => {
    styleCache.del(cachekey(feature))
  })

  return (feature, resolution) => {
    const key = cachekey(feature)
    const style = styleCache.get(key) || provider(feature, resolution)
    styleCache.set(key, style, 60000)
    return style
  }
}

/**
 * FEATURE STYLE FUNCTION.
 */
export default (mode, source) => {
  const geometries = R.cond([
    [R.equals('Point'), R.always(symbolStyle(mode))],
    [R.equals('Polygon'), R.always(polygonStyle(mode))],
    [R.equals('LineString'), R.always(lineStyle(mode))],
    [R.equals('MultiPoint'), R.always(multipointStyle(mode))],
    [R.equals('GeometryCollection'), R.always(collectionStyle(mode))],
    [R.T, R.always(defaultStyle)]
  ])

  const provider = (feature, resolution) => {
    try {
      const geometryType = feature.getGeometry().getType()
      return geometries(geometryType)(feature, resolution)
    } catch (err) {
      console.error('[style]', feature, err)
      return []
    }
  }

  return source
    ? cachingProvider(provider, source)
    : provider
}
