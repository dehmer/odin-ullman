import React from 'react'
import TagList from '../components/TagList'
import emitter from '../emitter'

const scopes = ['ALL', 'LAYER', 'FEATURE', 'LINK', 'GROUP', 'SYMBOL', 'PLACE']
const action = 'search/scope'

const formatTags = scope => {
  const upper = (scope || '').toUpperCase()
  const xs = scopes.map(s => `${s === upper ? 'SCOPE' : 'SYSTEM'}:${s}:${action}` )
  if (scopes.includes(upper)) return xs
  else return [...xs, `SCOPE:${upper.replace(/ /g, '\u00A0')}:${action}`]
}

const reducer = (_, { scope }) => formatTags(scope)

export const Scopebar = props => {
  const [scopes, dispatch] = React.useReducer(reducer, formatTags('ALL'))

  React.useEffect(() => {
    emitter.on('search/provider/updated', dispatch)
    return () => emitter.off('search/provider/updated', dispatch)
  }, [])

  return (
    <div className='scopebar'>
      <TagList
        tags={scopes.join(' ')}
      />
    </div>
  )
}
