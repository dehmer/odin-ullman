import * as R from 'ramda'
import emitter from '../emitter'
import selection from '../selection'
import { storage } from '.'
import { isLayer, isPlace, isGroup } from './ids'

const taggable = id => !isGroup(id)

const addtag_ = tag => item => {
  item.tags = R.uniq([...(item.tags || []), tag.toLowerCase()])
  if (isPlace(item.id)) item.sticky = true
}

const removetag_ = tag => item => (item.tags = (item.tags || []).filter(x => x.toLowerCase() !== tag.toLowerCase()))


/**
 *
 */
emitter.on(`:id(.*)/tag/add`, ({ id, tag }) => {

  // 'default' tag can only by applied to a single layer.
  const ids = tag.toLowerCase() === 'default' && isLayer(id)
    ? [id]
    : R.uniq([id, ...selection.selected(taggable)])

  const ops = ids
    .map(storage.getItem)
    .map(R.tap(addtag_(tag)))
    .reduce((acc, item) => acc.concat({ type: 'put', key: item.id, value: item }), [])

  // Special handling: layer/default.
  if (tag.toLowerCase() === 'default' && isLayer(id)) storage.keys('layer:')
    .map(storage.getItem)
    .filter(layer => (layer.tags || []).includes('default'))
    .map(R.tap(removetag_('default')))
    .forEach(layer => ops.push({ type: 'put', key: layer.id, value: layer }))

  storage.batch(ops)
})


/**
 *
 */
emitter.on(`:id(.*)/tag/remove`, ({ id, tag }) => {
  const ops = R.uniq([id, ...selection.selected(taggable)])
    .map(storage.getItem)
    .map(R.tap(removetag_(tag)))
    .reduce((acc, item) => acc.concat({ type: 'put', key: item.id, value: item }), [])

  storage.batch(ops)
})
