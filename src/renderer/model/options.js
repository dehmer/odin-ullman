import * as R from 'ramda'
import * as level from '../storage/level'
import { url } from '../storage/symbols'
import { searchIndex } from '../search/lunr'
import { layerId, isLayer } from '../storage/ids'


export const options = {}

// -> Spotlight interface.

/**
 * feature:
 */
options.feature = async (feature, cache) => {
  const tags = feature => {
    const dimensions = feature.dimensions || []
    const scope = feature.scope || []
    const identity = feature.identity || []

    return [
      'SCOPE:FEATURE:identify',
      ...((feature.links || []).length ? ['IMAGE:LINKS:links:mdiLink'] : []),
      feature.hidden ? 'SYSTEM:HIDDEN:show' : 'SYSTEM:VISIBLE:hide',
      ...dimensions.map(label => `SYSTEM:${label}:NONE`),
      ...scope.map(label => `SYSTEM:${label}:NONE`),
      ...identity.map(label => `SYSTEM:${label}:NONE`),
      ...(feature.tags || []).map(label => `USER:${label}:NONE`)
    ].join(' ')
  }

  const layer = await cache(layerId(feature.id))
  const { properties } = feature
  const { sidc, t } = properties
  const hierarchy = feature.hierarchy || ['N/A']
  const description = layer.name.toUpperCase() + ' ⏤ ' + hierarchy.join(' • ')

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


/**
 * group:
 */
options.group = async (group, cache) => {

  const ids = searchIndex(group.terms)
    .filter(({ ref }) => !ref.startsWith('group:'))
    .map(R.prop('ref'))
  const items = await all(ids, cache)

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


/**
 * layer:
 */
options.layer = layer => {
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

  return {
    id: layer.id,
    title: layer.name,
    description: layer.type === 'socket' ? layer.url : null,
    tags: tags(layer),
    capabilities: 'RENAME|TAG|DROP',
    actions: 'PRIMARY:panto'
  }
}


/**
 * symbol:
 */
options.symbol = symbol => {
  const replace = (s, i, r) => s.substring(0, i) + r + s.substring(i + r.length)

  const tags = symbol => [
    'SCOPE:SYMBOL:NONE',
    ...symbol.dimensions.map(label => `SYSTEM:${label}:NONE`),
    ...symbol.scope.map(label => `SYSTEM:${label}:NONE`),
    ...(symbol.tags || []).map(label => `USER:${label}:NONE`)
  ].join(' ')

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

/**
 * place:
 */
options.place = place => {
  const tags = place => [place.class, place.type]
    .filter(R.identity)
    .map(label => `SYSTEM:${label}:NONE`)

  return {
    id: place.id,
    title: place.name,
    description: place.description,
    tags: [
      'SCOPE:PLACE:identify',
      ...tags(place),
      ...(place.tags || []).map(label => `USER:${label}:NONE`)
    ].join(' '),
    capabilities: 'TAG|RENAME',
    actions: 'PRIMARY:panto'
  }
}


/**
 * link:
 */
options.link = async (link, cache) => {

  const path = type => {
    switch (type) {
      case 'application/pdf': return 'mdiAdobeAcrobat'
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': return 'mdiMicrosoftExcel'
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': return 'mdiMicrosoftWord'
      case 'application/msword': return 'mdiMicrosoftWord'
      default: return 'mdiFileDocumentOutline'
    }
  }

  const container = await cache(link.ref)
  const containerName = isLayer(link.ref)
    ? container.name
    : container.properties.t

  return {
    id: link.id,
    title: link.name + ' ⏤ ' + containerName,
    description: link.lastModifiedDate,
    path: path(link.type),
    tags: [
      'SCOPE:LINK:NONE',
      ...(link.tags || []).map(label => `USER:${label}:NONE`)
    ].join(' '),
    capabilities: 'TAG',
    actions: 'PRIMARY:panto'
  }
}


/**
 * project:
 */
options.project = project => ({
  id: project.id,
  title: project.name,
  tags: [
    'SCOPE:PROJECT:NONE',
    ...(project.open ? ['SYSTEM:OPEN:NONE'] : []),
    ...(project.tags || []).map(label => `USER:${label}:NONE`)
  ].join(' '),
  capabilities: 'TAG|RENAME',
  actions: 'PRIMARY:open'
})

function memoize(method) {
  const cache = {}
  return async function() {
    const args = JSON.stringify(arguments)
    cache[args] = cache[args] || method.apply(this, arguments)
    return cache[args]
  }
}

export const all = (ids, cache = memoize(level.value)) => {
  return ids.reduce(async (accp, id) => {
    const acc = await accp
    const item = await cache(id)
    const option = await options[item.id.split(':')[0]](item, cache)
    acc.push(option)
    return acc
  }, [])
}