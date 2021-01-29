import * as R from 'ramda'
import uuid from 'uuid-random'
import emitter from '../emitter'
import selection from '../selection'
import * as level from '../storage/level'
import { fields, selectors } from './forms'
import { isFeature } from '../storage/ids'

const intersect = (a, b) => a.filter(x => b.includes(x))

emitter.on('project/open', () => {
  fields.forEach(field => level.put(field, { quiet: true }))
  selectors.forEach(selector => level.put(selector, { quiet: true }))
})

const selector = (form, matches) => {
  const matchers = {}

  matchers['~='] = ([_, attr, op, value], item) => {
    const values = item[attr]
      ? Array.isArray(item[attr])
        ? item[attr].map(value => value.toLowerCase())
        : item[attr].split(' ').map(value => value.toLowerCase())
      : []

    return !!values.find(x => x.includes(value))
  }

  matchers['*='] = ([_, attr, op, value], item) => item[attr]
    ? item[attr].toLowerCase().includes(value.toLowerCase())
    : false

  return item => {
    const forms = matches.map(match => {
      const op = match[2]
      if(matchers[op] && matchers[op](match, item)) return form
    }).filter(R.identity)

    if (!forms.length) return []

    // Multiple/different forms per item are not supported.
    if (R.uniq(forms.map(R.prop('id'))).length > 1) {
      console.error('[forms]: unsupported multiple matches', item)
      return []
    }

    return forms[0].fields
  }
}


/**
 *
 */
emitter.on('selection', async () => {

  // Feature-only for now.
  const selected = selection.selected(id => isFeature(id))
  if (!selected.length) return emitter.emit('properties/updated', { result: [] })

  const forms = (await level.values('form:'))
    .reduce((acc, form) => {
      acc[form.id] = form
      return acc
    }, {})

  const fields = (await level.values('field:'))
    .reduce((acc, field) => {
      acc[field.id] = field
      return acc
    }, {})

  const selectors = Object.values(forms).map(form => {
    const matches = (Array.isArray(form.selector) ? form.selector : [form.selector])
      .map(selector => /(\w+)\s*([~*]?=)\s*(\w+)\s*([iIsS]?)/.exec(selector))
    return selector(form, matches)
  })

  const extractValue = (property, item) => {
    return Array.isArray(property)
      ? property.length === 2
        ? item.properties[property[0]][property[1]]
        : item.properties[property[0]].substring(property[1], property[2] + 1)
      : item.properties[property]
  }

  const value = xs => xs.length === 1 ? xs[0] : null // null: multiple values

  const genericProperties = items => {
    const properties = items.reduce((acc, item) => {
      Object.entries(item.properties).reduce((acc, [key, value]) => {
        acc[key] = acc[key] || []
        acc[key].push(value)
        return acc
      }, acc)
      return acc
    }, {})

    return Object.entries(properties).map(([key, values]) => {
      const field = {
        id: `field:${uuid()}`,
        label: key.toUpperCase(),
        value: value(R.uniq(values)),
        property: key,
        ids: items.map(R.prop('id'))
      }

      return field
    })
  }

  const formProperties = items => items
    .map(item => R.uniq(selectors.flatMap(selector => selector(item))))
    .reduce(intersect)
    .map(id => fields[id])
    .map(R.tap(field => field.value = items.map(item => extractValue(field.property, item))))
    .map(R.tap(field => field.value = R.uniq(field.value)))
    .map(R.tap(field => field.value = value(field.value)))
    .map(R.tap(field => field.ids = items.map(R.prop('id'))))

  const items = await level.values(selected)
  if (!items.length) return []

  const properties = (items => {
    const properties = formProperties(items)
    if (properties.length) return properties
    else return genericProperties(items)
  })(items)

  emitter.emit('properties/updated', { result: properties })
})
