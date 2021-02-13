import path from 'path'
import * as R from 'ramda'
import unzipper from 'unzipper'
import { Transform, Writable } from 'stream'
import uuid from 'uuid-random'
import { GeoJSON } from 'ol/format'
import * as geom from 'ol/geom'
import proj4 from 'proj4'
import iconv from 'iconv-lite'
import { decode as decodeDBF } from './dbase'
import { decode as decodeSHP } from './shapefile'
import * as ShapeType from './shapetype'
import * as level from '../storage/level'
import emitter from '../emitter'

const loadLayerFile = file => new Promise((resolve, reject) => {
  const layername = filename => R.dropLast(5, filename) // '.json'
  const reader = new FileReader()

  reader.onload = ({ target }) => {
    if (target.error) return reject(target.error)
    const layer = JSON.parse(target.result)
    layer.name = layername(file.name)
    layer.features.forEach(feature => delete feature.title)
    resolve(layer)
  }

  reader.readAsText(file)
})

export const loadLayerFiles = async files =>
  Promise.all(files.map(loadLayerFile))


// ==> SHAPEFILE

const geoJSON = new GeoJSON()

const batch = layer => new Writable({
  objectMode: true,
  async write(chunk, encoding, next) {
    this.ops = this.ops || []
    this.ops.push({ type: 'put', key: chunk.id, value: chunk })
    if (this.ops.length === 500) {
      await level.batch(this.ops, { quiet: true })
      this.ops = []
    }
    next()
  },

  async final(next) {
    await level.batch(this.ops, { quiet: true })
    emitter.emit('storage/put', { key: layer.id, value: layer })
    emitter.emit('layer/refresh', { id: layer.id })
    next()
  }
})

const asString = stream => new Promise((resolve, reject) => {
  if (!stream) return resolve(null)
  const chunks = []
  stream.on("data", chunk => chunks.push(chunk))
  stream.on("end", () => resolve(Buffer.concat(chunks).toString()))
})

const encoding = cpg => iconv.encodingExists(cpg)
  ? cpg
  : cpg && cpg.length > 5 && iconv.encodingExists(cpg.slice(5))
    ? cpg.slice(5)
    : null

const decode = cpg => cpg
  ? (buffer => iconv.decode(buffer, encoding(cpg)).replace(/\0/g, '').trim())
  : (buffer => buffer.toString().replace(/\0/g, '').trim())


const feature = (layerUUID, proj, records) => {
  const projA = xs => xs.map(proj)
  const projAA = xs => xs.map(projA)

  const geometry = (shapeType, points) => {
    switch (shapeType) {
      case ShapeType.POINT:
      case ShapeType.POINT_Z:
      case ShapeType.POINT_M: return new geom.Point(projA(points)[0])
      case ShapeType.MULTIPOINT:
      case ShapeType.MULTIPOINT_Z:
      case ShapeType.MULTIPOINT_M: new geom.MultiPoint(projA(points))
      case ShapeType.POLYLINE:
      case ShapeType.POLYLINE_Z:
      case ShapeType.POLYLINE_M: return points.length === 1
        ? new geom.LineString(projA(points[0]))
        : new geom.MultiLineString(projAA(points))
      case ShapeType.POLYGON:
      case ShapeType.POLYGON_Z:
      case ShapeType.POLYGON_M: {
        return new geom.Polygon(projAA(points))
      }
      default: return null
    }
  }

  return ({ recordNumber, shapeType, points }) => {
    return {
      id: `feature:${layerUUID}/${uuid()}`,
      type: 'Feature',
      properties: records[recordNumber - 1],
      geometry: geoJSON.writeGeometryObject(geometry(shapeType, points))
    }
  }
}

export const loadShapefile = async filename => {
  const directory = await unzipper.Open.file(filename)
  const extensions = ['.shp', '.prj', '.cpg', '.dbf']
  const groups = R.groupBy(file => path.basename(file.path, path.extname(file.path)))
  const files = directory.files.filter(file => extensions.includes(path.extname(file.path)))

  Object.entries(groups(files)).forEach(async ([name, files]) => {
    const find = extname => files.find(file => path.extname(file.path) === extname)
    const cpg = await (find('.cpg') && asString(find('.cpg').stream()))
    const prj = await (find('.prj') && asString(find('.prj').stream()))
    const proj = proj4(prj)
    const dbf = await find('.dbf').buffer()
    const records = decodeDBF(dbf, decode(cpg))

    const layerUUID = uuid()
    const layer = { id: `layer:${layerUUID}`, name }
    level.put(layer, { quiet: true })

    find('.shp').stream()
      .pipe(decodeSHP(feature(layerUUID, proj.inverse, records)))
      .pipe(batch(layer))
  })
}
