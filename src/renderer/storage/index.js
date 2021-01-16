import level from 'level'
// import { storage } from './memory'
import { storage } from './local'

const master = level('master', { valueEncoding: 'json' })
var store = level('4cd84a72-adfe-4156-9c49-23436661c441', { valueEncoding: 'json' })

console.log(master, store)

export { storage }
