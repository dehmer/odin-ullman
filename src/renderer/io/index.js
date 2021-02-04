import path from 'path'
import * as R from 'ramda'
import unzipper from 'unzipper'
import { Transform } from 'stream'
import { GeoJSON } from 'ol/format'
import proj4 from 'proj4'
import iconv from 'iconv-lite'
import { decode as decodeDBF } from './dbase'
import { decode as decodeSHP } from './shapefile'

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
const collect = (name, records) => new Transform({
  objectMode: true,
  transform(chunk, encoding, next) {
    this.features = this.features || []
    if (chunk.recordNumber !== undefined) {
      this.features.push({
        type: 'Feature',
        properties: records[chunk.recordNumber - 1],
        geometry: geoJSON.writeGeometryObject(chunk.geometry)
      })
    }

    next()
  },

  flush(next) {
    this.push({
      name,
      type: 'FeatureColleciton',
      features: this.features
    })
    next()
  }
})

const asString = stream => new Promise((resolve, reject) => {
  if (!stream) return resolve(null)
  const chunks = []
  stream.on("data", chunk => chunks.push(chunk))
  stream.on("end", () => resolve(Buffer.concat(chunks).toString()))
})

export const loadShapefile = async (filename, callback) => {
  const directory = await unzipper.Open.file(filename)
  const extensions = ['.shp', '.prj', '.cpg', '.dbf']
  const groups = R.groupBy(file => path.basename(file.path, path.extname(file.path)))
  const files = directory.files.filter(file => extensions.includes(path.extname(file.path)))

  Object.entries(groups(files)).forEach(async ([name, files]) => {
    const find = extname => files.find(file => path.extname(file.path) === extname)
    const cpg = await (find('.cpg') && asString(find('.cpg').stream()))

    const encoding = iconv.encodingExists(cpg)
      ? cpg
      : cpg && cpg.length > 5 && iconv.encodingExists(cpg.slice(5))
        ? cpg.slice(5)
        : null

    const toString = encoding
      ? (buffer => iconv.decode(buffer, encoding).replace(/\0/g, '').trim())
      : (buffer => buffer.toString().replace(/\0/g, '').trim())

    const prj = await (find('.prj') && asString(find('.prj').stream()))
    const proj = proj4(prj)

    const dbf = await find('.dbf').buffer()
    const records = decodeDBF(dbf, toString)

    find('.shp').stream()
      .pipe(decodeSHP(proj.inverse))
      .pipe(collect(name, records))
      .on('data', callback)
  })
}
