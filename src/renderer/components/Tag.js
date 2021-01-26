import React from 'react'
import { TagIcon } from './TagIcon'
import * as mdi from '@mdi/js'
import emitter from '../emitter'

const Tag = props => {
  const { variant, children } = props
  const closable = variant === 'USER'
  const variantClassName = variant ? `tag-${variant.toLowerCase()}` : ''
  const className = props.action !== 'NONE'
    ? `tag-active ${variantClassName}`
    : `tag ${variantClassName}`

  const style = {
    color: props.color,
    backgroundColor: props.backgroundColor,
    borderColor: props.borderColor
  }

  const handleClick = event => {
    event.stopPropagation()
    if (props.onClick) return props.onClick()
    else if (props.action === 'NONE') return

    const path = props.id
      ? `${props.id}/${props.action}`
      : `${props.action}/${props.label.toLowerCase()}`

    emitter.emit(path)
  }

  const handleDoubleClick = event => {
    console.log('handleDoubleClick', event)
    const capabilities = props.capabilities || ''
    if (!capabilities.includes('FOLLOW')) return
    emitter.emit(`${props.id}/follow`)
  }

  const handleMouseDown = () => {
    if (props.action === 'NONE') return
    if (!props.id) return
    emitter.emit(`${props.id}/${props.action}/down`)
  }

  const handleMouseUp = () => {
    if (props.action === 'NONE') return
    if (!props.id) return
    emitter.emit(`${props.id}/${props.action}/up`)
  }

  return (
    <span
      className={className}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      style={style}
    >
      { children }
      {
        closable &&
        props.capabilities.includes('TAG') &&
        <TagIcon
          path={mdi.mdiClose}
          closable={closable}
          onClose={props.onClose}
          color='grey'
        />
      }

    </span>
  )
}

export default React.memo(Tag)
