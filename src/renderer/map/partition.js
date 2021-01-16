import VectorSource from 'ol/source/Vector'
import { source } from '../model/source'
import selection from '../selection'
import emitter from '../emitter'

/**
 * Partition initial source into selected/deselected vector sources.
 */

export const deselectedSource = new VectorSource()
export const selectedSource = new VectorSource()

const sources = [deselectedSource, selectedSource]
const featureById = id => sources.reduce((acc, source) => {
  return acc || source.getFeatureById(id)
}, null)

const addFeature = feature => selection.isSelected(feature.getId())
  ? selectedSource.addFeature(feature)
  : deselectedSource.addFeature(feature)

const moveFeature = (from, to) => feature => {
  if (!feature) return
  if (from.hasFeature(feature)) from.removeFeature(feature)
  if (!to.hasFeature(feature)) to.addFeature(feature)
}

source.on('addfeature', ({ feature }) => addFeature(feature))

source.on('removefeature', ({ feature }) => {
  selection.isSelected(feature.getId())
    ? selectedSource.removeFeature(feature)
    : deselectedSource.removeFeature(feature)
})

source.getFeatures().forEach(addFeature)

const movetoSelected = moveFeature(deselectedSource, selectedSource)
const movetoDeselected = moveFeature(selectedSource, deselectedSource)

emitter.on('selection', ({ selected, deselected }) => {
  selected.map(featureById).forEach(movetoSelected)
  deselected.map(featureById).forEach(movetoDeselected)
})
