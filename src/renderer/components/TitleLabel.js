import React from 'react'

export const TitleLabel = React.memo(props => {
  const { title } = props
  return <div className='title-label'>{title}</div>
})
