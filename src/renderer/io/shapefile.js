import * as R from 'ramda'
import * as geom from 'ol/geom.js'
import { decoder } from './decoder'

const zipN = (...xs) => [...xs[0]].map((_, i) => xs.map(xs => xs[i]))

const geomNull = recordNumber => ({ recordNumber, geometry: null })
const geomPoint = (recordNumber, coordinates, layout) => ({ recordNumber, geometry: new geom.Point(coordinates, layout) })
const geomMultiPoint = (recordNumber, coordinates, layout) => ({ recordNumber, geometry: new geom.MultiPoint(coordinates, layout) })
const geomPolygon = (recordNumber, coordinates, layout) => ({ recordNumber, geometry: new geom.Polygon(coordinates, layout) })
const geomLineString = (recordNumber, coordinates, layout) => ({ recordNumber, geometry: new geom.LineString(coordinates, layout) })
const geomMultiLineString = (recordNumber, coordinates, layout) => ({ recordNumber, geometry: new geom.MultiLineString(coordinates, layout) })

const NULL = 0
const POINT = 1
const POLYLINE = 3
const POLYGON = 5
const MULTIPOINT = 8
const POINT_Z = 11
const POLYLINE_Z = 13
const POLYGON_Z = 15
const MULTIPOINT_Z = 18
const POINT_M = 21
const POLYLINE_M = 23
const POLYGON_M = 25
const MULTIPOINT_M = 28
const MULTIPATCH = 31

const recordDecoders = {}


/**
 *
 */
const fileHeader = (buffer, _, next) => {
  const fileCode = buffer.int32BE()
  buffer.skip(5 * 4)

  // The value for file length is the total length of the file
  // in 16-bit words (including the fifty 16-bit words that
  // make up the header).
  const fileLength = buffer.int32BE()
  const version = buffer.int32LE()
  const shapeType = buffer.int32LE()

  // xmin, ymin, xmax, ymax
  // zmin, zmax, mmin, mmax
  const bbox = R.range(0, 8).map(_ => buffer.doubleLE())
  next({ fileCode, fileLength, version, shapeType, bbox })

  const recordDecoder = recordDecoders[shapeType]
  if (!recordDecoder) throw new Error(`unsupported shape type: ${shapeType}`)
  return recordDecoder
}


/**
 *
 */
const recordHeader = buffer => ({
  recordNumber: buffer.int32BE(),

  // The content length for a record is the length of
  // the record contents section measured in 16-bit words.
  // Each record, therefore, contributes (4 + content length)
  // __16-bit words__ toward the total length of the file,
  // as stored at Byte 24 in the file header.

  contentLength: buffer.int32BE(),
  shapeType: buffer.int32LE()
})


/**
 * Z and/or M values (ignore preceding range).
 */
const decodeValues = (buffer, n) => {
  buffer.skip(16) // min, max: ignore (2 x doubleLE)
  return R.range(0, n).map(_ => buffer.doubleLE())
}


/**
 *
 */
const decodePoints = (buffer, proj) => {
  buffer.skip(32) // box: ignore (4 x 8)
  const numPoints = buffer.int32LE()
  const points = R.range(0, numPoints).map(_ => [buffer.doubleLE(), buffer.doubleLE()]).map(proj)
  return { numPoints, points }
}


/**
 *
 */
const decodeParts = (buffer, proj) => {
  buffer.skip(32) // box: ignore (4 x 8)
  const numParts = buffer.int32LE()
  const numPoints = buffer.int32LE()
  const partIndexes = R.range(0, numParts).map(_ => buffer.int32LE()).concat(undefined)
  const points = R.range(0, numPoints).map(_ => [buffer.doubleLE(), buffer.doubleLE()]).map(proj)
  return { numParts, numPoints, partIndexes, points }
}


/**
 * POINT, POINT_M, POINT_Z
 */
const point = options => (buffer, proj, next) => {
  const header = recordHeader(buffer)
  if (header.shapeType === NULL) return next(geomNull(header.recordNumber))

  const layout = options.layout === 'XYZM'
    ? header.contentLength === 14 ? 'XYZ' : 'XYZM'
    : options.layout

  const coordinates = proj(R.range(0, layout.length).map(_ => buffer.doubleLE()))
  next(geomPoint(header.recordNumber, coordinates, layout))
}


/**
 * MULTIPOINT
 */
const multipoint = options => (buffer, proj, next) => {
  const header = recordHeader(buffer)
  if (header.shapeType === NULL) return next(geomNull(header.recordNumber))
  const { numPoints, points } = decodePoints(buffer, proj)

  const coordinates = R.cond([
    [R.equals('XY'), () => points],
    [R.equals('XYM'), () => {
      return zipN(points, decodeValues(buffer, numPoints)).map(xs => [].concat(...xs))
    }]
  ])(options.layout)

  next(geomMultiPoint(header.recordNumber, coordinates, options.layout))
}


/**
 * POLYGON, POLYGON_M
 */
const polygon = options => (buffer, proj, next) => {
  const header = recordHeader(buffer)
  if (header.shapeType === NULL) return next(geomNull(header.recordNumber))

  const { numPoints, partIndexes, points } = decodeParts(buffer, proj)
  const rings = points => R.aperture(2, partIndexes).map(([start, end]) => points.slice(start, end))

  const coordinates = R.cond([
    [R.equals('XY'), () => rings(points)],
    [R.equals('XYM'), () => {
      return rings(zipN(points, decodeValues(buffer, numPoints)).map(xs => [].concat(...xs)))
    }]
  ])(options.layout)

  next(geomPolygon(header.recordNumber, coordinates, options.layout))
}


/**
 * POLYLINE, POLYLINE_M, POLYLINE_Z
 */
const polyline = options => (buffer, proj, next) => {
  const header = recordHeader(buffer)
  if (header.shapeType === NULL) return next(geomNull(header.recordNumber))

  const { numParts, numPoints, partIndexes, points } = decodeParts(buffer, proj)
  const strings = points => R.aperture(2, partIndexes).map(([start, end]) => points.slice(start, end))

  // Measure is optional.
  // Read only if z offset is greater than content length;
  // offsets in bytes; content length in 16-bit words.
  const x = 44 + (4 * numParts)
  const y = x + (16 * numPoints)
  const z = y + 16 + (8 * numPoints)
  const layout = options.layout === 'XYZM'
    ? z === (header.contentLength * 2) ? 'XYZ' : 'XYZM'
    : options.layout

  // Read M and/or Z values (ignore range).
  const doubleLE = () => {
    buffer.skip(16) // min/max: ignore
    return R.range(0, numPoints).map(_ => buffer.doubleLE())
  }

  const arrays = R.cond([
    [R.equals('XY'), () => [points]],
    [R.equals('XYM'), () => [points, doubleLE()]],
    [R.equals('XYZ'), () => [points, doubleLE()]],
    [R.equals('XYZM'), () => [points, doubleLE(), doubleLE()]]
  ])(layout)

  const coordinates = zipN(...arrays).map(xs => [].concat(...xs))
  const geometry = numParts === 1
    ? geomLineString(header.recordNumber, coordinates, layout)
    : geomMultiLineString(header.recordNumber, strings(coordinates), layout)

  next(geometry)
}

recordDecoders[POINT] = point({ shapeType: POINT, layout: 'XY' })
recordDecoders[POLYLINE] = polyline({ shapeType: POLYLINE, layout: 'XY' })
recordDecoders[POLYGON] = polygon({ shapeType: POLYGON, layout: 'XY' })
recordDecoders[MULTIPOINT] = multipoint({ shapeType: MULTIPOINT, layout: 'XY' })
recordDecoders[POINT_Z] = point({ shapeType: POINT_Z, layout: 'XYZM' })
recordDecoders[POLYLINE_Z] = polyline({ shapeType: POLYLINE_Z, layout: 'XYZM' })
recordDecoders[POLYLINE_M] = polyline({ shapeType: POLYLINE_M, layout: 'XYM' })
recordDecoders[POINT_M] = point({ shapeType: POINT_M, layout: 'XYM' })
recordDecoders[POLYGON_M] = polygon({ shapeType: POLYGON_M, layout: 'XYM' })
recordDecoders[MULTIPOINT_M] = multipoint({ shapeType: MULTIPOINT_M, layout: 'XYM' })

export const decode = proj => {
  var fn = fileHeader
  return decoder((acc, next) => (fn = fn(acc, proj, next) || fn))
}
