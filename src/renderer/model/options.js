import * as R from 'ramda'
import { storage } from '../storage'
import { hierarchy, url, dimensions, scopes } from './symbols'
import { searchIndex } from '../search/lunr'
import { layerId } from '../storage/ids'
import { identity } from './sidc'

export const options = {}

// -> Spotlight interface.

/**
 * feature:/
 */
options.feature = (() => {
  const tags = ({ hidden, tags, links, follow }, sidc) => [
    'SCOPE:FEATURE:identify',
    ...((links || []).length ? ['IMAGE:LINKS:links:mdiLink'] : []),
    hidden ? 'SYSTEM:HIDDEN:show' : 'SYSTEM:VISIBLE:hide',
    ...(follow ? ['SYSTEM:FOLLOW:NONE'] : []),
    ...dimensions(sidc).map(label => `SYSTEM:${label}:NONE`),
    ...scopes(sidc).map(label => `SYSTEM:${label}:NONE`),
    ...(identity(sidc)).map(label => `SYSTEM:${label}:NONE`),
    ...(tags || []).map(label => `USER:${label}:NONE`)
  ].join(' ')

  const option = feature => {
    const layer = storage.getItem(layerId(feature.id))
    const { properties } = feature
    const { sidc, t } = properties
    const description = layer
      ? layer.name.toUpperCase() + ' ⏤ ' + hierarchy(sidc).join(' • ')
      : hierarchy(sidc).join(' • ')

    return {
      id: feature.id,
      title: t || 'N/A',
      description,
      url: url(sidc),
      tags: tags(feature, sidc),
      capabilities: 'RENAME|TAG|DROP|FOLLOW',
      actions: 'PRIMARY:panto'
    }
  }

  return id => option(storage.getItem(id))
})()


/**
 * group:/
 */
options.group = (() => {
  const option = group => {

    const items = searchIndex(group.terms)
      .filter(({ ref }) => !ref.startsWith('group:'))
      .map(({ ref }) => options[ref.split(':')[0]](ref))

    const tags = R.uniq(items.flatMap(item => item.tags.split(' ')))
      .filter(tag => tag.match(/SYSTEM:(HIDDEN|VISIBLE).*/))

    return {
      id: group.id,
      title: group.name,
      tags: [
        'GROUP:GROUP:identify',
        ...(group.scope || []).map(label => `SCOPE:${label}:NONE`),
        'IMAGE:OPEN:open:mdiArrowDown',
        ...tags,
        ...(group.tags || []).map(label => `USER:${label}:NONE`)
      ].join(' '),
      capabilities: 'RENAME|TAG'
    }
  }

  return id => option(storage.getItem(id))
})()


/**
 * layer:/
 */
options.layer = (() => {

  const tags = feature => {
    const { type, hidden, active, tags, links } = feature

    const socket = type === 'socket'
      ? active
        ? [`SYSTEM:ACTIVE:suspend`]
        : [`SYSTEM:INACTIVE:resume`]
      : []

    return [
      'SCOPE:LAYER:identify',
      ...((links || []).length ? ['IMAGE:LINKS:links:mdiLink'] : []),
      'IMAGE:OPEN:open:mdiArrowDown',
      hidden ? 'SYSTEM:HIDDEN:show' : 'SYSTEM:VISIBLE:hide',
      ...[socket],
      ...(tags || []).map(label => `USER:${label}:NONE`)
    ].join(' ').replace('  ', ' ').trim()
  }

  const option = layer => {
    const description = layer.type === 'socket'
      ? layer.url
      : null

    return {
      id: layer.id,
      title: layer.name,
      description,
      tags: tags(layer),
      capabilities: 'RENAME|TAG|DROP',
      actions: 'PRIMARY:panto'
    }
  }

  return id => option(storage.getItem(id))
})()


/**
 * symbol:/
 */
options.symbol = (() => {
  const replace = (s, i, r) => s.substring(0, i) + r + s.substring(i + r.length)

  const tags = ({ sidc, tags }) => [
    'SCOPE:SYMBOL:NONE',
    ...dimensions(sidc).map(label => `SYSTEM:${label}:NONE`),
    ...scopes(sidc).map(label => `SYSTEM:${label}:NONE`),
    ...(tags || []).map(label => `USER:${label}:NONE`)
  ].join(' ')

  const option = symbol => {
    return {
      id: symbol.id,
      title: R.last(symbol.hierarchy),
      description: R.dropLast(1, symbol.hierarchy).join(' • '),
      url: url(replace(replace(symbol.sidc, 1, 'F'), 3, 'P')),
      scope: 'SYMBOL',
      tags: tags(symbol),
      capabilities: 'TAG',
      actions: 'PRIMARY:draw'
    }
  }

  return id => option(storage.getItem(id))
})()

options.place = (() => {
  const tags = entry => [entry.class, entry.type]
    .filter(R.identity)
    .map(label => `SYSTEM:${label}:NONE`)

  const option = entry => {
    return {
      id: entry.id,
      title: entry.name,
      description: entry.description,
      tags: [
        'SCOPE:PLACE:identify',
        ...tags(entry),
        ...(entry.tags || []).map(label => `USER:${label}:NONE`)
      ].join(' '),
      capabilities: 'TAG|RENAME',
      actions: 'PRIMARY:panto'
    }
  }

  return id => option(storage.getItem(id))
})()

options.link = (() => {

  const path = type => {
    switch (type) {
      case 'application/pdf': return 'mdiAdobeAcrobat'
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': return 'mdiMicrosoftExcel'
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': return 'mdiMicrosoftWord'
      case 'application/msword': return 'mdiMicrosoftWord'
      default: return 'mdiFileDocumentOutline'
    }
  }

  const option = link => {
    return {
      id: link.id,
      title: link.name + ' ⏤ ' + link.container,
      description: link.lastModifiedDate,
      path: path(link.type),
      tags: [
        'SCOPE:LINK:NONE',
        ...(link.tags || []).map(label => `USER:${label}:NONE`)
      ].join(' '),
      capabilities: 'TAG'
    }
  }

  return id => option(storage.getItem(id))
})()
