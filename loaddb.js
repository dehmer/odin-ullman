#!/usr/bin/env node
const fs = require('fs')
const level = require('level')

const items = JSON.parse(fs.readFileSync('data.json', 'utf8'))
const ops = items.map(item => ({ type: 'put', key: item.id, value: item }))
console.log(ops)

const db = level('db', { valueEncoding: 'json' })

;(async () => {
  await db.batch(ops)
})()
