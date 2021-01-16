import React from 'react'
import { Map } from '../map/Map'
import { PanelContainer } from './PanelContainer'
import '../search'

/**
 * <Map/> and <App/> are siblings with <body/> as parent.
 */
export const App = () => {
  return (
    <>
      <Map></Map>
      <PanelContainer></PanelContainer>
    </>
  )
}
