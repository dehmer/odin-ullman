import React from 'react'
import Body from './Body'
import { Avatar } from './Avatar'
import emitter from '../emitter'

// Selection has precedence over focus:
const className = (props) => (props.focus && !props.selected)
    ? 'card card-focus'
    : 'card'

const Card = React.forwardRef((props, ref) => {

  const [dropAllowed, setDropAllowed] = React.useState(null)
  const style = dropAllowed === true
    ? { backgroundColor: '#6abf1a20' }
    : dropAllowed === false
      ? { backgroundColor: '#e03c3120' }
      : {}

  const handleDoubleClick = () => {
    if (!props.actions) return
    const actions = props.actions.split('|')
    const action = actions.find(action => action.includes('PRIMARY'))
    if (!action) return
    emitter.emit(`${props.id}/${action.split(':')[1]}`)
  }

  const handleDragOver = event => {
    event.preventDefault()

    // allow drop if supported
    if (props.capabilities.includes('DROP')) {
      setDropAllowed(true)
    } else setDropAllowed(false)
  }

  const handleDragLeave = event => {
    setDropAllowed(null)
  }

  const handleDrop = event => {
    event.preventDefault()
    setDropAllowed(null)
    if (props.capabilities.includes('DROP')) {
      const files = [...event.dataTransfer.files]
      emitter.emit(`${props.id}/links/add`, { files })
    }
  }

  return (
    <div
      className={className(props, dropAllowed)}
      ref={ref}
      role='option'
      aria-selected={props.selected}
      style={style}
      onClick={props.onClick}
      onDoubleClick={handleDoubleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Body
        id={props.id}
        title={props.title}
        description={props.description}
        tags={props.tags}
        edit={props.edit}
        capabilities={props.capabilities}
      />
      { (props.url || props.path) ? <Avatar url={props.url} path={props.path}/> : null }
    </div>
  )
})

export default React.memo(Card)