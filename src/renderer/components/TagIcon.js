import React from 'react'
import Icon from '@mdi/react'

export const TagIcon = React.memo(props => {
  const { path, closable, onClose, color } = props

  const className = closable
    ? 'tag-icon tag-close-icon'
    : 'tag-icon'

  return (
    <span className={className} onClick={onClose}>
      <Icon path={path} size='12px' color={color}/>
    </span>
  )
})
