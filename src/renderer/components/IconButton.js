import React from 'react'
import Icon from '@mdi/react'

export const IconButton = props => {
  const { path, onClick, enabled, selected } = props
  const color = enabled ? null : 'lightgrey'

  const className = selected ? 'iconbutton-selected' : 'iconbutton'

  return (
    <div className={className} onClick={onClick}>
      <Icon path={path} size={1} color={color}/>
    </div>
  )
}
