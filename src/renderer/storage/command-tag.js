import * as R from 'ramda'
import emitter from '../emitter'
import selection from '../selection'
import * as level from './level'
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
emitter.on(`:id(.*)/tag/add`, async ({ id, tag }) => {

  // 'default' tag can only by applied to a single layer.
  const ids = tag.toLowerCase() === 'default' && isLayer(id)
    ? [id]
    : R.uniq([id, ...selection.selected(taggable)])

  const items = await Promise.all(ids.map(level.getItem))
  const ops = items
    .map(R.tap(addtag_(tag)))
    .reduce((acc, item) => acc.concat({ type: 'put', key: item.id, value: item }), [])

  // Special handling: layer/default.
  if (tag.toLowerCase() === 'default' && isLayer(id)) {
    (await level.getItems('layer:', layer => (layer.tags || []).includes('default')))
      .map(R.tap(removetag_('default')))
      .forEach(layer => ops.push({ type: 'put', key: layer.id, value: layer }))
  }

  level.batch(ops)
})


/**
 *
 */
emitter.on(`:id(.*)/tag/remove`, async ({ id, tag }) => {
  const ids = R.uniq([id, ...selection.selected(taggable)])
  const items = await Promise.all(ids.map(level.getItem))

  const ops = items
    .map(R.tap(removetag_(tag)))
    .reduce((acc, item) => acc.concat({ type: 'put', key: item.id, value: item }), [])

  level.batch(ops)
})
