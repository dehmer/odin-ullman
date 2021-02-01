import React from 'react'
import { Toolbar } from './Toolbar'
import Spotlight from './Spotlight'
import Properties from './Properties'

export const PanelContainer = () => (
  <div className='panel-container fullscreen'>
    <Toolbar/>
    <Spotlight/>
    <Properties/>
  </div>
)
