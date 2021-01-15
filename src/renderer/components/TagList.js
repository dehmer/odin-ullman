import React from 'react'
import Tag from './Tag'
import * as mdi from '@mdi/js'
import emitter from '../emitter'
import { TagIcon } from './TagIcon'

const TagList = props => {
  const { id, tags } = props
  const [inputVisible, setInputVisible] = React.useState(false)
  const [inputValue, setInputValue] = React.useState('')
  const inputRef = React.createRef()

  const handleClose = tag => () => {
    emitter.emit(`${id}/tag/remove`, { tag })
  }

  const onClick = () => {
    setInputValue('')
    setInputVisible(true)
  }

  const tag = spec => {
    const [variant, label, action, path] = spec.split(':')
    return (
      <Tag
        key={`${variant}:${label}`}
        id={id}
        variant={variant}
        action={action}
        label={label}
        onClose={handleClose(label)}
        capabilities={props.capabilities}
      >
        {
          variant !== 'IMAGE'
            ? <span>{label}</span>
            : <TagIcon path={mdi[path]} color='black' size='12px'/>
        }
      </Tag>
    )
  }

  const confirmInput = () => {
    setInputVisible(false)
    if (!inputValue) return
    emitter.emit(`${id}/tag/add`, { tag: inputValue })
  }

  const handleKeyDown = event => {
    switch (event.code) {
      case 'Enter': {
        event.stopPropagation()
        confirmInput()
        break;
      }
      case 'Escape': {
        event.stopPropagation()
        setInputVisible(false)
        break;
      }
      case 'KeyA': {
        if (event.metaKey) event.stopPropagation()
        break;
      }
    }
  }

  const handleChange = ({ target }) => {
    setInputValue(target.value)
  }

  const newTag = (props.capabilities || '').includes('TAG')
    ? inputVisible
      ? <input
        className='tag-input'
        ref={inputRef}
        autoFocus
        onBlur={confirmInput}
        onKeyDown={handleKeyDown}
        onChange={handleChange}
      >
      </input>
    : <Tag variant='plus' onClick={onClick} color='black'>
        <TagIcon path={mdi.mdiPlus} size='12px'/>
        <span>ADD TAG</span>
      </Tag>
  : null


  return (
    <div className='tag-list'>
      { (tags || '').split(' ').map(tag) }
      { newTag }
    </div>
  )
}

export default React.memo(TagList)
