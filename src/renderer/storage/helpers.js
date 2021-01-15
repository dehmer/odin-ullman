import { storage } from '.'
import { isLayer, isFeature, layerId } from './ids'

export const getItem = id => storage.getItem(id)
export const getFeatures = keys => p => keys.filter(isFeature).map(getItem).filter(p)
export const isContained = id => feature => layerId(feature) === id
export const getContainedFeatures = id => isLayer(id)
  ? getFeatures(storage.keys())(isContained(id))
  : []
