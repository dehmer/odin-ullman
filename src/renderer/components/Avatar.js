import React from 'react'
import Icon from '@mdi/react'
import * as mdi from '@mdi/js'

export const Avatar = React.memo(({ url, path }) => {
  return (
    <div className='card-avatar'>
      {
        url
          ? <img className='avatar-image' src={url}></img>
          : <Icon path={mdi[path]} size='48px' color='black'/>
      }
    </div>
  )
})
