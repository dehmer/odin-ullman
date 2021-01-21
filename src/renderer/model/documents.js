import * as R from 'ramda'
import { hierarchy, dimensions, scopes } from './symbols'
import { layerId } from '../storage/ids'
import { identity } from './sidc'

export const documents = {}

// -> lunr documents interface

/**
 *
 */
documents.feature = (feature, cache = []) => {
  const layer = cache[layerId(feature.id)]
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
    id: feature.id,
    scope: 'feature',
    tags: tags(feature),
    text: `${t} ${hierarchy(sidc).join(' ')} ${layer.name}`
  }
}


/**
 *
 */
documents.group = group => {
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
documents.layer = layer => {
  const { name: text, hidden, tags } = layer
  const links = layer.links || []

  return {
    id: layer.id,
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
documents.symbol = symbol => {
  const tags = ({ dimension, scope, tags }) => [
    ...dimension ? dimension.split(', ') : [],
    ...scope ? scope.split(', ') : [],
    ...(tags || [])
  ]

  return ({
    id: symbol.id,
    scope: 'symbol',
    text: symbol.hierarchy.join(' '),
    tags: tags(symbol)
  })
}


/**
 *
 */
documents.place = place => ({
  id: place.id,
  scope: 'place',
  text: place.display_name,
  tags: [place.class, place.type, ...(place.tags || [])].filter(R.identity)
})


/**
 *
 */
documents.link = link => ({
  id: link.id,
  scope: 'link',
  text: link.name,
  tags: link.tags
})


/**
 *
 */
documents.project = project => ({
  id: project.id,
  scope: 'project',
  text: project.name,
  tags: project.open ? ['open'] : ''
})