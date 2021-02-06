import path from 'path'
import * as R from 'ramda'
import unzipper from 'unzipper'
import { Transform, Writable } from 'stream'
import uuid from 'uuid-random'
import { GeoJSON } from 'ol/format'
import proj4 from 'proj4'
import iconv from 'iconv-lite'
import { decode as decodeDBF } from './dbase'
import { decode as decodeSHP } from './shapefile'
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

const feature = (layerUUID, records) => {
  return new Transform({
    objectMode: true,
    transform(chunk, encoding, next) {
      next(null, {
        id: `feature:${layerUUID}/${uuid()}`,
        type: 'Feature',
        properties: records[chunk.recordNumber - 1],
        geometry: geoJSON.writeGeometryObject(chunk.geometry)
      })
    }
  })
}

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
      .pipe(decodeSHP(proj.inverse))
      .pipe(feature(layerUUID, records))
      .pipe(batch(layer))
  })
}
