import path from 'path'
import fs from 'fs'
import assert from 'assert'
import { Transform } from 'stream';
import GeoJSON from 'ol/format/GeoJSON'
import { decode } from '../src/renderer/io/shapefile'

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

const compareJSON = (filename, expected) => {
  const dirname = path.dirname(filename)
  const basename = path.basename(filename, '.shp')
  const actual = fs.readFileSync(path.join(dirname, `geometry-${basename}.json`), 'utf8')
  assert.strictEqual(actual, expected)
}

const parse = filename => {
  const basename = path.basename(filename)
  const unsupported = ['mpatch3.shp', 'multipatch.shp']
  if (unsupported.includes(basename)) return

  it(`[shp/parse] ${basename}`, function (done) {
    fs.createReadStream(filename)
      .pipe(decode())
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


