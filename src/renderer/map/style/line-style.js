import * as geom from 'ol/geom'
import { normalize } from '../../model/sidc'
import { labels as lineLabels } from './line-labels'
import { geometries } from './line-geometries'
import { styleFactory, defaultStyle } from './default-style'
import { format } from '../format'

export const lineStyle = mode => (feature, resolution) => {
  const sidc = normalize(feature.getProperties().sidc)
  const geometry = feature.getGeometry()
  const reference = geometry.getFirstCoordinate()
  const { read, write } = format(reference)
  const line = read(geometry)
  const factory = styleFactory({ mode, feature, resolution })(write)
  const options = { feature, resolution, line, styles: factory, write }
  const firstPoint = () => new geom.Point(geometry.getFirstCoordinate())

  const labels = () => {
    if (!factory.showLabels()) return []
    return (lineLabels[sidc] || []).flatMap(fn => fn(feature, resolution))
  }

  return [
    geometries[sidc] ? geometries[sidc](options).flat() : defaultStyle(feature),
    mode === 'multi' ? factory.handles(read(firstPoint())) : [],
    factory.wireFrame(line),
    labels()
  ].flat()
}
