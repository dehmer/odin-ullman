import * as R from 'ramda'
import { hierarchy, dimensions, scopes } from './symbols'
import { layerId } from '../storage/ids'
import { storage } from '../storage'
import { identity } from './sidc'

export const documents = {}

// -> lunr documents interface

/**
 *
 */
documents.feature = id => {
  const feature = storage.getItem(id)
  const layer = storage.getItem(layerId(id))
  const { t, sidc } = feature.properties
  const links = feature.links || []

  const tags = ({ hidden, tags }) => [
    hidden ? 'hidden' : 'visible',
    ...(links.length ? ['link'] : []),
    ...(tags || []),
    ...dimensions(sidc),
    ...scopes(sidc),
    ...identity(sidc)
  ]

  return {
    id,
    scope: 'feature',
    tags: tags(feature),
    text: `${t} ${hierarchy(sidc).join(' ')} ${layer.name}`
  }
}

/**
 *
 */
documents.group = id => {
  const group = storage.getItem(id)

  return {
    id: group.id,
    text: group.name,
    scope: [...(group.scope || []), 'group'],
    tags: group.tags
  }
}

/**
 *
 */
documents.layer = id => {
  const layer = storage.getItem(id)
  const { name: text, hidden, tags } = layer
  const links = layer.links || []

  return {
    id,
    scope: 'layer',
    text,
    tags: [
      hidden ? 'hidden' : 'visible',
      ...(links.length ? ['link'] : []),
      ...(tags || [])
    ]
  }
}

/**
 *
 */
documents.symbol = id => {
  const tags = ({ dimension, scope, tags }) => [
    ...dimension ? dimension.split(', ') : [],
    ...scope ? scope.split(', ') : [],
    ...(tags || [])
  ]

  const symbol = storage.getItem(id)

  return ({
    id,
    scope: 'symbol',
    text: symbol.hierarchy.join(' '),
    tags: tags(symbol)
  })
}

documents.place = id => {
  const entry = storage.getItem(id)
  return {
    id,
    scope: 'place',
    text: entry.display_name,
    tags: [entry.class, entry.type, ...(entry.tags || [])].filter(R.identity)
  }
}

documents.link = id => {
  const entry = storage.getItem(id)

  return {
    id,
    scope: 'link',
    text: entry.name,
    tags: entry.tags
  }
}