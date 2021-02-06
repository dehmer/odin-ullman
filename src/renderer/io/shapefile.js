import * as R from 'ramda'
import * as geom from 'ol/geom.js'
import { decoder } from './decoder'
import { UnderflowError } from './bytebuffer.js'

const zipN = (...xs) => [...xs[0]].map((_, i) => xs.map(xs => xs[i]))

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

const layoutMatch = (shapeType, hasZ, hasM) =>
  layout => layout[0] === shapeType && layout[1] === hasZ && layout[2] === hasM

const layouts = [
  [POLYLINE, false, false, 'XY'],
  [POLYLINE_Z, true, false, 'XYZ'],
  [POLYLINE_Z, true, true, 'XYZM'],
  [POLYLINE_M, true, false, 'XYM'],
  [POLYGON, false, false, 'XY'],
  [POLYGON_Z, true, false, 'XYZ'],
  [POLYGON_Z, true, true, 'XYZM'],
  [POLYGON_M, true, false, 'XYM'],
]


const fileHeader = (buffer, _, next) => {
  const fileCode = buffer.int32BE()
  if (fileCode !== 9994) throw new Error(`'[shapefile] invalid file code: ${fileCode}'`)
  buffer.skip(5 * 4) // unused
  buffer.skip(2 * 4) // file length, version

  const shapeType = buffer.int32LE()
  const decoder = recordDecoders[shapeType]
  if (!decoder) throw new Error(`unsupported shape type: ${shapeType}`)

  buffer.skip(8 * 8) // bounding boxes: x, y, z, m
  return (decoders => decoders.replace(decoder))
}

const point = (buffer, proj, next) => {
  const recordNumber = buffer.int32BE()
  const length = buffer.int32BE() * 2

  const shapeType = buffer.int32LE()
  if (shapeType === NULL) next({ recordNumber, geometry: null })
  else {
    const coordinates = proj([buffer.doubleLE(), buffer.doubleLE()])
    const remaining = length - 20
    buffer.skip(remaining) // skip possible Z/M values
    next({ recordNumber, geometry: new geom.Point(coordinates) })
  }
}

const multipoint = (buffer, proj, next) => {
  const recordNumber = buffer.int32BE()
  const length = buffer.int32BE() * 2

  const shapeType = buffer.int32LE()
  if (shapeType === NULL) next({ recordNumber, geometry: null })
  else {
    buffer.skip(32) // box: ignore (4 x 8)
    const numPoints = buffer.int32LE()
    const points = R.range(0, numPoints).map(_ => [buffer.doubleLE(), buffer.doubleLE()])
    const coordinates = points.map(proj)
    const remaining = length - 40 - numPoints * 16
    buffer.skip(remaining)
    next({ recordNumber, geometry: new geom.MultiPoint(coordinates) })
  }
}

const parts = context => (buffer, proj, next) => {
  const { numParts, numPoints } = context

  if (!context.parts) context.parts = []
  if (context.parts.length !== numParts) {
    const expected = numParts - context.parts.length
    let available = Math.min(Math.floor(buffer.remaining() / 4), expected)
    if (!available) throw new UnderflowError('parts')
    R.range(0, available).forEach(_ => context.parts.push(buffer.int32LE()))
    return /* need more */
  }

  const layout = context.layout[3]

  const done = () => {
    context.points = context.points.map(proj)
    context.parts.push(undefined)
    const geometry = context.factory(context)
    next({ recordNumber: context.recordNumber, geometry })
    return (decoders => decoders.pop())
  }

  if (!context.points) context.points = []
  if (context.points.length !== numPoints) {
    const expected = numPoints - context.points.length
    let available = Math.min(Math.floor(buffer.remaining() / 16), expected)
    if (!available) throw new UnderflowError('points')
    R.range(0, available).forEach(_ => context.points.push([buffer.doubleLE(), buffer.doubleLE()]))
    if (layout === 'XY' && context.points.length === numPoints) return done()
    else return /* need more */
  }

  if (layout === 'XYZM') {
    if (!context.zs) { buffer.skip(16); context.zs = 0 }
    if (context.zs !== numPoints) {
      const expected = numPoints - context.zs
      let available = Math.min(Math.floor(buffer.remaining() / 8), expected)
      if (!available) throw new UnderflowError('zs')
      buffer.skip(available * 8)
      context.zs += available
      return  /* need more */
    }
  }

  if (layout !== 'XY') {
    if (!context.ms) { buffer.skip(16); context.ms = 0 }
    if (context.ms !== numPoints) {
      const expected = numPoints - context.ms
      let available = Math.min(Math.floor(buffer.remaining() / 8), expected)
      if (!available) throw new UnderflowError('ms')
      buffer.skip(available * 8)
      context.ms += available
      if (context.ms === numPoints) return done()
      else return  /* need more */
    }
  }
}

const poly = factory => (buffer, proj, next) => {
  const recordNumber = buffer.int32BE()
  const contentLength = buffer.int32BE()

  const shapeType = buffer.int32LE()
  if (shapeType === NULL) next({ recordNumber, geometry: null })
  else {
    if (!recordDecoders[shapeType]) throw new Error(`invalid shape type: ${shapeType}`)
    buffer.skip(4 * 8) // box (X/Y)
    const numParts = buffer.int32LE()
    const numPoints = buffer.int32LE()

    const X = 44 + 4 * numParts  // offset [bytes]: Points
    const Y = X + 16 * numPoints // offset [bytes]: Zmin
    const Z = Y + 16 + 8 * numPoints // offset [bytes]: Mmin (optional)
    const length = 2 * contentLength
    const hasZ = Y < length
    const hasM = Z < length

    const layout = layouts.find(layoutMatch(shapeType, hasZ, hasM))
    const context = { factory, recordNumber, numParts, numPoints, layout }
    return (decoders => decoders.push(parts(context)))
  }
}

const gon = ({ parts, points }) => {
  const rings = R.aperture(2, parts).map(([start, end]) => points.slice(start, end))
  return new geom.Polygon(rings)
}

const line = ({ numParts, parts, points }) => {
  const strings = points => R.aperture(2, parts).map(([start, end]) => points.slice(start, end))
  return numParts === 1
    ? new geom.LineString(points)
    : new geom.MultiLineString(strings(points))
}

recordDecoders[POINT] = point
recordDecoders[POLYLINE] = poly(line)
recordDecoders[POLYGON] = poly(gon)
recordDecoders[MULTIPOINT] = multipoint
recordDecoders[POINT_Z] = point
recordDecoders[POLYLINE_Z] = poly(line)
recordDecoders[POLYGON_Z] = poly(gon)
recordDecoders[MULTIPOINT_Z] = multipoint
recordDecoders[POLYLINE_M] = poly(line)
recordDecoders[POINT_M] = point
recordDecoders[POLYGON_M] = poly(gon)
recordDecoders[MULTIPOINT_M] = multipoint

export const decode = proj => {
  const stack = [fileHeader]
  const decoders = {
    peek: () => stack[stack.length - 1],
    replace: fn => stack[stack.length - 1] = fn,
    push: fn => stack.push(fn),
    pop: () => stack.pop()
  }

  return decoder((acc, next) => {
    const succ = decoders.peek()(acc, proj, next)
    if (succ) succ(decoders)
  })
}
