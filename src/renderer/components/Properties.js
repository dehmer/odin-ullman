import React from 'react'
import uuid from 'uuid-random'
import Property from './Property'
import emitter from '../emitter'


const handlers = {}


/**
 *
 */
handlers['properties/updated'] = (state, { result }) => {
  return result
}

/**
 *
 */
const reducer = (state, event) => {
  const handler = handlers[event.path]
  return handler ? handler(state, event) : state
}


/**
 *
 */
const Properties = () => {
  const [state, dispatch] = React.useReducer(reducer, [])

  React.useEffect(() => {
    const paths = ['properties/updated']
    paths.forEach(path => emitter.on(path, dispatch))
    return () => paths.forEach(path => emitter.off(path, dispatch))
  }, [])

  const property = props => <Property key={uuid()} {...props}/>

  return (
    <div
      className="properties panel"
      tabIndex='0'
    >
      {state.map(property)}
    </div>
  )
}

export default React.memo(Properties)
