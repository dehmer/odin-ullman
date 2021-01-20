import * as R from 'ramda'
import { storage } from '../storage'
import * as level from '../storage/level'
import { hierarchy, url, dimensions, scopes } from './symbols'
import { searchIndex } from '../search/lunr'
import { layerId } from '../storage/ids'
import { identity } from './sidc'


export const options = {}

// -> Spotlight interface.

/**
 * feature:
 */
options.feature = async feature => {
  if (typeof feature === 'string') {
    return options.feature(await level.getItem(feature))
  }

  const tags = ({ hidden, tags, links }, sidc) => [
    'SCOPE:FEATURE:identify',
    ...((links || []).length ? ['IMAGE:LINKS:links:mdiLink'] : []),
    hidden ? 'SYSTEM:HIDDEN:show' : 'SYSTEM:VISIBLE:hide',
    ...dimensions(sidc).map(label => `SYSTEM:${label}:NONE`),
    ...scopes(sidc).map(label => `SYSTEM:${label}:NONE`),
    ...(identity(sidc)).map(label => `SYSTEM:${label}:NONE`),
    ...(tags || []).map(label => `USER:${label}:NONE`)
  ].join(' ')

  const layer = await level.getItem(layerId(feature.id))
  const { properties } = feature
  const { sidc, t } = properties
  const description = layer.name.toUpperCase() + ' ⏤ ' + hierarchy(sidc).join(' • ')

  return {
    id: feature.id,
    title: t || 'N/A',
    description,
    url: url(sidc),
    tags: tags(feature, sidc),
    capabilities: 'RENAME|TAG|DROP',
    actions: 'PRIMARY:panto'
  }
}


/**
 * group:
 */
options.group = async group => {
  if (typeof group === 'string') {
    return options.group(await level.getItem(group))
  }

  const ps = searchIndex(group.terms)
    .filter(({ ref }) => !ref.startsWith('group:'))
    .map(({ ref }) => options[ref.split(':')[0]](ref))

  const items = await Promise.all(ps)
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
options.layer = async layer => {
  if (typeof layer === 'string') {
    return options.layer(await level.getItem(layer))
  }

  const tags = ({ hidden, tags, links }) => [
    'SCOPE:LAYER:identify',
    ...((links || []).length ? ['IMAGE:LINKS:links:mdiLink'] : []),
    'IMAGE:OPEN:open:mdiArrowDown',
    hidden ? 'SYSTEM:HIDDEN:show' : 'SYSTEM:VISIBLE:hide',
    ...(tags || []).map(label => `USER:${label}:NONE`)
  ].join(' ')

  return {
    id: layer.id,
    title: layer.name,
    tags: tags(layer),
    capabilities: 'RENAME|TAG|DROP',
    actions: 'PRIMARY:panto'
  }
}


/**
 * symbol:
 */
options.symbol = async symbol => {
  if (typeof symbol === 'string') {
    return options.symbol(await level.getItem(symbol))
  }

  const replace = (s, i, r) => s.substring(0, i) + r + s.substring(i + r.length)

  const tags = ({ sidc, tags }) => [
    'SCOPE:SYMBOL:NONE',
    ...dimensions(sidc).map(label => `SYSTEM:${label}:NONE`),
    ...scopes(sidc).map(label => `SYSTEM:${label}:NONE`),
    ...(tags || []).map(label => `USER:${label}:NONE`)
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

options.place = async place => {
  if (typeof place === 'string') {
    return options.place(await level.getItem(place))
  }

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
options.link = async link => {
  if (typeof link === 'string') {
    return options.link(await level.getItem(link))
  }

  const path = type => {
    switch (type) {
      case 'application/pdf': return 'mdiAdobeAcrobat'
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': return 'mdiMicrosoftExcel'
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': return 'mdiMicrosoftWord'
      case 'application/msword': return 'mdiMicrosoftWord'
      default: return 'mdiFileDocumentOutline'
    }
  }

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
