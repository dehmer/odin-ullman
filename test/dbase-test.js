import assert from 'assert'
import path from 'path'
import fs from 'fs'
import { decode } from '../src/renderer/io/dbase'

it('[dbf/parse] cities', function() {
  // TODO: replace with iconv
  const toString = buffer => buffer.toString().replace(/\0/g, '').trim()
  const buffer = fs.readFileSync(path.resolve('./test/shapelib-mexico/cities.dbf'))
  const actual = JSON.stringify(decode(buffer, toString))
  const expected = fs.readFileSync(path.resolve('./test/shapelib-mexico/properties-cities.json'), 'utf8')
  assert.strictEqual(actual, expected)
})
