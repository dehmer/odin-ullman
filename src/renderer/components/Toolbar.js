import React from 'react'
import * as mdi from '@mdi/js'
import { IconButton } from './IconButton'

const providerSelected = scope => {}

const descriptors = [
  {
    key: 'search',
    enabled: true,
    path: mdi.mdiMagnify,
    action: () => providerSelected(),
    selected: true
  },
  {
    key: 'tiles',
    enabled: false,
    path: mdi.mdiMap,
    action: () => providerSelected(),
  },
  {
    key: 'layers',
    enabled: true,
    path: mdi.mdiLayersTriple,
    action: () => providerSelected('layer')
  },
  {
    key: 'palette',
    enabled: true,
    path: mdi.mdiPalette,
    action: () => providerSelected('symbol')
  },
  {
    key: 'places',
    enabled: true,
    path: mdi.mdiMapMarker,
    action: () => providerSelected('feature')
  },
  { key: 'meassure', enabled: false, path: mdi.mdiAngleAcute },
  { key: 'properties', enabled: false, path: mdi.mdiCardBulletedSettings },
  { key: 'undo', enabled: false, path: mdi.mdiUndo },
  { key: 'redo', enabled: false, path: mdi.mdiRedo },
  { key: 'cut', enabled: false, path: mdi.mdiContentCut },
  { key: 'copy', enabled: false, path: mdi.mdiContentCopy },
  { key: 'paste', enabled: false, path: mdi.mdiContentPaste },
  // mdi.mdiBookmarkPlus
  // mdi.mdiCamera
  // mdi.mdiViewGridPlus

]

export const Toolbar = props => {

  const [tools, setTools] = React.useState(descriptors)

  const handleClick = index => () => {
    const [...descriptors] = tools
    if (!descriptors[index].enabled) return
    descriptors.forEach(descriptor => descriptor.selected = false)
    descriptors[index].selected = true
    setTools(descriptors)
    descriptors[index].action()
  }

  const button = (descriptor, index) => <IconButton
    key={descriptor.key}
    path={descriptor.path}
    onClick={handleClick(index)}
    enabled={descriptor.enabled}
    selected={descriptor.selected}
  />

  const entries = tools.map(button)
  return <ul className='toolbar panel'>{entries}</ul>
}
