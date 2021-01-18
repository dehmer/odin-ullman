import * as R from 'ramda'
import lunr from 'lunr'
import emitter from '../emitter'
import * as level from '../storage/level'
import { documents } from '../model/documents'

/**
 * Adapt domain models to indexable documents and
 * document refs to spotlight (view) model objects.
 */

var index

;(() => {
  const nullScope = () => null
  const scope = key => documents[key.split(':')[0]] || nullScope

  const reindex = async () => {
    console.time('[lunr] re-index')

    const items = await level.getItems()
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
      this.field('text')
      this.field('scope')
      this.field('tags')

      docs.forEach(doc => this.add(doc))
    })

    console.timeEnd('[lunr] re-index')
    emitter.emit('index/updated')
  }

  reindex()
  emitter.on('storage/updated', reindex)
  emitter.on('storage/batch', reindex)
  emitter.on('storage/put', reindex)
})()

export const searchIndex = R.tryCatch(
  terms => terms.trim() ? index.search(terms.trim()) : [],
  R.always([])
)
