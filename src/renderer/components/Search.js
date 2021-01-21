import React from 'react'
import emitter from '../emitter'

export const Search = () => {
  const [value, setValue] = React.useState('')
  const ref = React.useRef()

  React.useEffect(() => {
    const handler = () => {
      setValue('')
      ref.current.focus()
    }

    emitter.on('search/provider/updated', handler)
    return () => emitter.off('search/provider/updated', handler)
  })

  const handleChange = ({ target }) => {
    setValue(target.value)
    emitter.emit('search/filter/updated', { value: target.value, mode: 'continuous' })
  }

  const handleKeyDown = event => {
    if (event.key === 'a' && event.metaKey) return event.stopPropagation()
    else if (event.key === 'ArrowDown') return event.preventDefault()
    else if (event.key === 'ArrowUp') return event.preventDefault()
    else if (event.key === 'Escape') {
      setValue('')
      emitter.emit('search/filter/updated', { value: '', mode: 'continuous' })
    } else if (event.key === 'Enter') {
      event.stopPropagation()
      if (event.metaKey) emitter.emit('storage/group')
      else emitter.emit('search/filter/updated', { value, mode: 'enter' })
    } else if (event.key === '1' && event.metaKey) emitter.emit('search/scope/all')
    else if (event.key === '2' && event.metaKey) emitter.emit('search/scope/layer')
    else if (event.key === '3' && event.metaKey) emitter.emit('search/scope/feature')
    else if (event.key === '4' && event.metaKey) emitter.emit('search/scope/link')
    else if (event.key === '5' && event.metaKey) emitter.emit('search/scope/group')
    else if (event.key === '6' && event.metaKey) emitter.emit('search/scope/symbol')
    else if (event.key === '7' && event.metaKey) emitter.emit('search/scope/place')
    else if (event.key === '8' && event.metaKey) emitter.emit('search/scope/project')
  }

  return (
    <div className='search-container'>
      <input
        ref={ref}
        className='search-input'
        placeholder='Spotlight Search'
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
    </div>
  )
}
