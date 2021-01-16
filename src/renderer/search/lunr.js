import * as R from 'ramda'
import lunr from 'lunr'
import emitter from '../emitter'
import { storage } from '../storage'
import { documents } from '../model/documents'

/**
 * Adapt domain models to indexable documents and
 * document refs to spotlight (view) model objects.
 */

var index

;(() => {
  const nullScope = () => null
  const scope = key => documents[key.split(':')[0]] || nullScope

  const reindex = () => {
    console.time('[lunr] re-index')
    index = lunr(function () {
      this.pipeline.remove(lunr.stemmer)
      this.pipeline.remove(lunr.stopWordFilter) // allow words like 'so', 'own', etc.
      this.searchPipeline.remove(lunr.stemmer)
      this.field('text')
      this.field('scope')
      this.field('tags')

      storage.keys()
        .map(key => scope(key)(key))
        .filter(R.identity)
        .forEach(document => this.add(document))
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
