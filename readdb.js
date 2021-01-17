#!/usr/bin/env node
const level = require('level')
const db = level('db', { valueEncoding: 'json' })

const values = () => new Promise((resolve, reject) => {
  const xs = []
  db.createReadStream({ keys: false, values: true })
    .on('data', data => xs.push(data))
    .once('end', () => resolve(xs))
})

;(async () => {
  console.time('read')
  const xs = await values()
  console.log(xs.length)
  console.timeEnd('read')
})()
