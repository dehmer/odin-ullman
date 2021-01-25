import * as R from 'ramda'
import uuid from 'uuid-random'
import emitter from '../emitter'
import selection from '../selection'
import * as level from '../storage/level'
import forms from './forms.json'

const intersect = (a, b) => a.filter(x => b.includes(x))

emitter.on('project/open', () => {
  forms.fields.forEach(field => level.put(field, { quiet: true }))
  forms.selectors.forEach(selector => level.put(selector, { quiet: true }))
})

const selector = (form, match) => {
  const [_, attr, op, value, flag] = match

  const matchers = {}

  matchers['~='] = item => {
    const values = item[attr]
      ? Array.isArray(item[attr])
        ? item[attr].map(value => value.toLowerCase())
        : item[attr].split(' ').map(value => value.toLowerCase())
      : []
    return values.includes(value)
  }

  matchers['*='] = item => item[attr]
    ? item[attr].toLowerCase().includes(value.toLowerCase())
    : false

  return item => matchers[op]
    ? matchers[op](item)
      ? form.fields
      : []
    : []
}

emitter.on('properties/show', async () => {
  if (!selection.selected().length) return

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
    const match = /(\w+)\s*([~*]?=)\s*(\w+)\s*([iIsS]?)/.exec(form.selector)
    return match ? selector(form, match) : R.always(null)
  })

  const extractValue = (property, item) => {
    return Array.isArray(property)
      ? item.properties[property[0]][property[1]]
      : item.properties[property]
  }

  const value = xs => xs.length === 1 ? xs[0] : null // null: multiple values

  const properties = async () => {
    const items = await level.values(selection.selected())
    if (!items.length) return []

    const form = items
      .map(item => R.uniq(selectors.flatMap(selector => selector(item))))
      .reduce(intersect)
      .map(id => fields[id])
      .map(R.tap(field => field.value = items.map(item => extractValue(field.property, item))))
      .map(R.tap(field => field.value = R.uniq(field.value)))
      .map(R.tap(field => field.value = value(field.value)))
      .map(R.tap(field => field.ids = items.map(R.prop('id'))))

    if (form.length) return form
    else {
      const properties = items.reduce((acc, item) => {
        Object.entries(item.properties).reduce((acc, [key, value]) => {
          acc[key] = acc[key] || []
          acc[key].push(value)
          return acc
        }, acc)
        return acc
      }, {})

      const form = Object.entries(properties).map(([key, values]) => {
        const field = {
          id: `field:${uuid()}`,
          label: key,
          value: value(R.uniq(values)),
          property: key,
          ids: items.map(R.prop('id'))
        }

        return field
      })

      return form
    }
  }

  emitter.emit('search/provider', {
    scope: 'PROPERTIES',
    provider: async (query, callback) => callback(await properties())
  })
})