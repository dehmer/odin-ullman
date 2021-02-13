import * as R from 'ramda'
import * as geom from 'ol/geom.js'
import { decoder } from './decoder'
import { UnderflowError } from './bytebuffer.js'
import * as ShapeType from './shapetype'

const recordDecoders = {}

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

const point = (buffer, factory, next) => {
  const recordNumber = buffer.int32BE()
  const length = buffer.int32BE() * 2

  const shapeType = buffer.int32LE()
  if (shapeType === ShapeType.NULL) next(factory({ recordNumber, shapeType }))
  else {
    const points = [[buffer.doubleLE(), buffer.doubleLE()]]

    // skip possible Z/M values
    const remaining = length - 20
    buffer.skip(remaining)
    next(factory({ recordNumber, shapeType, points }))
  }
}

const multipoint = (buffer, factory, next) => {
  const recordNumber = buffer.int32BE()
  const length = buffer.int32BE() * 2

  const shapeType = buffer.int32LE()
  if (shapeType === ShapeType.NULL) next(factory({ recordNumber, shapeType }))
  else {
    buffer.skip(32) // box: ignore (4 x 8)
    const numPoints = buffer.int32LE()
    const points = R.range(0, numPoints).map(_ => [buffer.doubleLE(), buffer.doubleLE()])

    // skip possible Z/M values
    const remaining = length - 40 - numPoints * 16
    buffer.skip(remaining)
    next(factory({ recordNumber, shapeType, points }))
  }
}

const parts = context => (buffer, factory, next) => {
  const { numParts, numPoints, hasM, hasZ } = context

  if (!context.parts) context.parts = []
  if (context.parts.length !== numParts) {
    const expected = numParts - context.parts.length
    let available = Math.min(Math.floor(buffer.remaining() / 4), expected)
    if (!available) throw new UnderflowError('parts')
    R.range(0, available).forEach(_ => context.parts.push(buffer.int32LE()))
    return /* need more */
  }

  const done = () => {
    context.parts.push(undefined)
    const recordNumber = context.recordNumber
    const shapeType = context.shapeType
    const points = R.aperture(2, context.parts).map(([start, end]) => context.points.slice(start, end))
    next(factory({ recordNumber, shapeType, points }))
    return (decoders => decoders.pop())
  }

  if (!context.points) context.points = []
  if (context.points.length !== numPoints) {
    const expected = numPoints - context.points.length
    let available = Math.min(Math.floor(buffer.remaining() / 16), expected)
    if (!available) throw new UnderflowError('points')
    R.range(0, available).forEach(_ => context.points.push([buffer.doubleLE(), buffer.doubleLE()]))
    if (!hasM && !hasZ && context.points.length === numPoints) return done()
    else return /* need more */
  }

  if (context.hasM) {
    if (!context.ms) { buffer.skip(16); context.ms = 0 }
    if (context.ms !== numPoints) {
      const expected = numPoints - context.ms
      let available = Math.min(Math.floor(buffer.remaining() / 8), expected)
      if (!available) throw new UnderflowError('ms')
      buffer.skip(available * 8)
      context.ms += available
      if (!hasZ && context.ms === numPoints) return done()
      else return  /* need more */
    }
  }

  if (context.hasZ) {
    if (!context.zs) { buffer.skip(16); context.zs = 0 }
    if (context.zs !== numPoints) {
      const expected = numPoints - context.zs
      let available = Math.min(Math.floor(buffer.remaining() / 8), expected)
      if (!available) throw new UnderflowError('zs')
      buffer.skip(available * 8)
      context.zs += available
      if (context.zs === numPoints) return done()
      else return  /* need more */
    }
  }
}

const poly = (buffer, factory, next) => {
  const recordNumber = buffer.int32BE()
  const contentLength = buffer.int32BE()

  const shapeType = buffer.int32LE()
  if (shapeType === ShapeType.NULL) next(factory({ recordNumber, shapeType }))
  else {
    if (!recordDecoders[shapeType]) throw new Error(`invalid shape type: ${shapeType}`)
    buffer.skip(4 * 8) // box (X/Y)
    const numParts = buffer.int32LE()
    const numPoints = buffer.int32LE()

    const X = 44 + 4 * numParts  // offset [bytes]: Points
    const Y = X + 16 * numPoints // offset [bytes]: Zmin
    const Z = Y + 16 + 8 * numPoints // offset [bytes]: Mmin (optional)
    const length = 2 * contentLength

    const hasZ = (shapeType === ShapeType.POLYLINE_Z || shapeType === ShapeType.POLYGON_Z)
    var hasM = (shapeType === ShapeType.POLYLINE_M || shapeType === ShapeType.POLYGON_M)
    if (shapeType === ShapeType.POLYLINE_Z || shapeType === ShapeType.POLYGON_Z) hasM = Z < length

    const context = { shapeType, recordNumber, numParts, numPoints, hasM, hasZ }
    return (decoders => decoders.push(parts(context)))
  }
}

recordDecoders[ShapeType.POINT] = point
recordDecoders[ShapeType.POLYLINE] = poly
recordDecoders[ShapeType.POLYGON] = poly
recordDecoders[ShapeType.MULTIPOINT] = multipoint
recordDecoders[ShapeType.POINT_Z] = point
recordDecoders[ShapeType.POLYLINE_Z] = poly
recordDecoders[ShapeType.POLYGON_Z] = poly
recordDecoders[ShapeType.MULTIPOINT_Z] = multipoint
recordDecoders[ShapeType.POLYLINE_M] = poly
recordDecoders[ShapeType.POLYGON_M] = poly
recordDecoders[ShapeType.POINT_M] = point
recordDecoders[ShapeType.MULTIPOINT_M] = multipoint

export const decode = factory => {
  const stack = [fileHeader]
  const decoders = {
    peek: () => stack[stack.length - 1],
    replace: fn => stack[stack.length - 1] = fn,
    push: fn => stack.push(fn),
    pop: () => stack.pop()
  }

  return decoder((acc, next) => {
    const succ = decoders.peek()(acc, factory, next)
    if (succ) succ(decoders)
  })
}
