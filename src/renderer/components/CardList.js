import React from 'react'

export const CardList = ({ children }) => {

  return (
    <div
      className='list-container'
    >
      <ul className='list' role='listbox' aria-multiselectable>
        { children }
      </ul>
    </div>
  )
}
