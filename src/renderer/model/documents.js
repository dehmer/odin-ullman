import * as R from 'ramda'
import { layerId } from '../storage/ids'

export const documents = {}

// -> lunr documents interface

/**
 *
 */
documents.feature = (feature, cache = []) => {
  const layer = cache[layerId(feature.id)]
  const { t } = feature.properties
  const links = feature.links || []

  const tags = ({ hidden, tags }) => [
    hidden ? 'hidden' : 'visible',
    ...(links.length ? ['link'] : []),
    ...(tags || []),
    ...(feature.dimensions || []),
    ...(feature.scope || []),
    ...(feature.identity || [])
  ]

  return {
    id: feature.id,
    scope: 'feature',
    tags: tags(feature),
    text: `${t} ${(feature.hierarchy || []).join(' ')} ${layer.name}`
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
  const { name: text, hidden, tags, type, active } = layer
  const links = layer.links || []

  const socket = type === 'socket'
    ? active ? [`ACTIVE`] : [`INACTIVE`]
    : []

  return {
    id: layer.id,
    scope: 'layer',
    text,
    tags: [
      hidden ? 'hidden' : 'visible',
      ...[socket],
      ...(links.length ? ['link'] : []),
      ...(tags || [])
    ]
  }
}


/**
 *
 */
documents.symbol = symbol => {
  const tags = [
    ...symbol.dimensions,
    ...symbol.scope,
    ...(symbol.tags || [])
  ]

  return ({
    id: symbol.id,
    scope: 'symbol',
    text: symbol.hierarchy.join(' '),
    tags
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
documents.project = project => {
  const tags = [
    ...(project.open ? ['open'] : []),
    ...(project.tags || [])
  ]

  return {
    id: project.id,
    scope: 'project',
    text: project.name,
    tags
  }
}