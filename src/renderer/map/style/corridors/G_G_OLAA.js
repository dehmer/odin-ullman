import * as R from 'ramda'
import * as TS from '../../ts'
import { arrowCoordinates } from './arrow'

/**
 * TACGRP.C2GM.OFF.LNE.AXSADV.ABN
 * AXIS OF ADVANCE / AIRBORNE
 */
export default options => {
  const { width, line, styles } = options

  const segments = TS.segments(line)
  const arrowRatio = Math.min(1, (R.last(segments).getLength() / width) / (3 / 4))
  if (arrowRatio < 1) throw new Error('segment too short')

  const [sx, sy] = [3 / 4, 1]
  const aps = arrowCoordinates(width, line)([
    [0, 0], [sx, sy], [sx, sy / 2], [sx, 0], [sx, -sy / 2], [sx, -sy]
  ])

  const bisection = (() => {
    const angle = segment => segment.angle()
    const average = xs => R.sum(xs) / xs.length
    const points = TS.coordinates([line])
    const point = TS.point(points[points.length - 2])
    const bearing = average(R.drop(segments.length - 2, segments).map(angle))
    return TS.lineString(TS.coordinates([
      TS.translate(bearing + Math.PI / 2, point)(width),
      TS.translate(bearing - Math.PI / 2, point)(width)
    ]))
  })()

  const arrow = TS.polygon(R.props([0, 1, 5, 0], aps))
  const buffer = TS.lineBuffer(TS.lineString([...R.init(line.getCoordinates()), aps[3]]))(width / 2).buffer(1)

  const intersection = TS.boundary(buffer).intersection(bisection)
  if (
    intersection.getGeometryType() !== 'MultiPoint' ||
    intersection.getNumGeometries() !== 2
  ) throw new Error('bad intersection')

  const crossing = (() => {
    const [p1, p2] = TS.coordinates(intersection)
    var a = TS.lineString([p1, aps[2]])
    var b = TS.lineString([p2, aps[4]])
    if (!a.intersects(b)) {
      a = TS.lineString([p1, aps[4]])
      b = TS.lineString([p2, aps[2]])
    }

    return TS.union([a, b])
  })()

  return styles.solidLine(TS.union([
    crossing,
    TS.lineString(R.props([4, 5, 0, 1, 2], aps)),
    TS.difference([
      TS.boundary(buffer),
      arrow,
      TS.pointBuffer(TS.startPoint(line))(width / 2),
      TS
        .geometryCollection([bisection, TS.point(aps[1]), TS.point(aps[5])])
        .convexHull()
    ])
  ]))
}
