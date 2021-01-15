import React from 'react'

export const Description = React.memo(props => {
  const main = props.value && <span className='card-description'>{props.value}</span>
  return <div>{main}</div>
})
