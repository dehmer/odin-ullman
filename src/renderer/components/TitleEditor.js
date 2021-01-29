import React from 'react'
import emitter from '../emitter'

export const TitleEditor = props => {
  const [value, setValue] = React.useState(props.value)

  const handleChange = ({ target }) => {
    setValue(target.value)
  }

  const commit = name => emitter.emit(`${props.id}/rename`, { name })
  const handleBlur = () => commit(value)

  const handleKeyDown = event => {
    const noop = () => { event.stopPropagation(); event.preventDefault() }
    if (event.key === 'a' && event.metaKey) event.stopPropagation()
    else if (event.key === 'ArrowDown') noop()
    else if (event.key === 'ArrowUp') noop()
    else if (event.key === 'Escape') commit(props.value)
    else if (event.key === ' ') event.stopPropagation()
    else if (event.key === 'Delete') event.stopPropagation()
  }

  return <div>
    <input
      className='title-input'
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      autoFocus
    />
  </div>
}
