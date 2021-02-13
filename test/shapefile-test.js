import * as R from 'ramda'
import path from 'path'
import fs from 'fs'
import assert from 'assert'
import { Transform } from 'stream'
import GeoJSON from 'ol/format/GeoJSON'
import * as geom from 'ol/geom.js'
import { decode } from '../src/renderer/io/shapefile'
import * as ShapeType from '../src/renderer/io/shapetype'

const format = new GeoJSON()

const collect = () => new Transform({
  objectMode: true,
  write(chunk, encoding, callback) {
    this.acc = this.acc || []
    if (chunk.geometry) this.acc.push(format.writeGeometry(chunk.geometry))
    else if (chunk.geometry === null) this.acc.push('null')
    callback(null)
  },

  final(callback) {
    this.push(this.acc.join('\n'))
    callback(null)
  }
})

const writeJSON = (filename, content) => {
  const dirname = path.dirname(filename)
  const basename = path.basename(filename, '.shp')
  fs.writeFileSync(path.join(dirname, `geometry-${basename}.json`), content)
}

const compareJSON = (filename, actual) => {
  const dirname = path.dirname(filename)
  const basename = path.basename(filename, '.shp')
  const expected = fs.readFileSync(path.join(dirname, `geometry-${basename}.json`), 'utf8')
  assert.strictEqual(actual, expected)
}

const parse = filename => {
  const basename = path.basename(filename)
  const unsupported = ['mpatch3.shp', 'multipatch.shp']
  if (unsupported.includes(basename)) return

  const factory = ({ recordNumber, shapeType, points }) => {
    switch (shapeType) {
      case ShapeType.POINT:
      case ShapeType.POINT_Z:
      case ShapeType.POINT_M: return { recordNumber, geometry: new geom.Point(points[0]) }
      case ShapeType.MULTIPOINT:
      case ShapeType.MULTIPOINT_Z:
      case ShapeType.MULTIPOINT_M: return { recordNumber, geometry: new geom.MultiPoint(points) }
      case ShapeType.POLYLINE:
      case ShapeType.POLYLINE_Z:
      case ShapeType.POLYLINE_M: return points.length === 1
        ? { recordNumber, geometry: new geom.LineString(points[0]) }
        : { recordNumber, geometry: new geom.MultiLineString(points) }
      case ShapeType.POLYGON:
      case ShapeType.POLYGON_Z:
      case ShapeType.POLYGON_M: return { recordNumber, geometry: new geom.Polygon(points) }
      default: return { recordNumber, geometry: null }
    }
  }

  it(`[shp/parse] ${basename}`, function (done) {
    fs.createReadStream(filename)
      .pipe(decode(factory))
      .pipe(collect())
      .on('data', data => compareJSON(filename, data))
      .on('finish', () => done())
  })
}

const directories = ['shapefile', 'shapelib', 'shapelib-mexico']
directories.forEach(dir => {
  const data = path.resolve(`./test/${dir}`)
  fs.readdir(data, (err, files) => {
    if (err) console.error(err)
    files
      .filter(file => file.endsWith('.shp'))
      .map(file => path.join(data, file))
      .forEach(parse)
  })
})


