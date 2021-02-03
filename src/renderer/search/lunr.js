import * as R from 'ramda'
import lunr from 'lunr'
import debounce from 'lodash.debounce'
import emitter from '../emitter'
import * as level from '../storage/level'
import { documents } from '../model/documents'

const nullScope = () => null
const scope = key => documents[key.split(':')[0]] || nullScope

const index = (name, scopes) => {
  var index

  const includes = op => scopes.includes(op.key.split(':')[0] + ':')

  const refresh = async ops => {
    const skip = index && ops && ops.length && !ops.find(includes)
    if (skip) return /* noting to do */

    console.time(`[lunr:${name}] re-index`)
    const reducer = async (accp, scope) => {
      const acc = await accp
      const values = await level.values(scope)
      return acc.concat(values)
    }

    const items = await scopes.reduce(reducer, [])
    const cache = items.reduce((acc, item) => {
      acc[item.id] = item
      return acc
    }, {})

    const docs = items
      .map(item => scope(item.id)(item, cache))
      .filter(R.identity)

    index = lunr(function () {
      this.pipeline.remove(lunr.stemmer)
      this.pipeline.remove(lunr.stopWordFilter) // allow words like 'so', 'own', etc.
      this.searchPipeline.remove(lunr.stemmer)
      ;['text', 'scope','tags'].forEach(field => this.field(field))
      docs.forEach(doc => this.add(doc))
    })

    console.timeEnd(`[lunr:${name}] re-index`)
    emitter.emit('index/updated')
  }

  return {
    refresh: debounce(refresh, 200),
    search: R.tryCatch(
      terms => terms.trim() ? index.search(terms.trim()) : [],
      R.always([])
    )
  }
}

const indexes = [
  index('symbol', ['symbol:']),
  index('project', ['project:', 'layer:', 'feature:', 'place:', 'link:', 'group:'])
]

emitter.on('storage/batch', ({ ops }) => indexes.forEach(index => index.refresh(ops)))
emitter.on('storage/put', ({ key, value }) => indexes.forEach(index => index.refresh([{ type: 'put', key, value }])))

export const searchIndex = terms => indexes.
  reduce((acc, index) => acc.concat(index.search(terms)), [])
