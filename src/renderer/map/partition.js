import VectorSource from 'ol/source/Vector'
import { source } from '../model/source'
import selection from '../selection'
import emitter from '../emitter'

/**
 * Partition initial source into selected/deselected vector sources.
 */

export const deselected_ = new VectorSource()
export const selected_ = new VectorSource()

const sources = [deselected_, selected_]
const featureById = id => sources.reduce((acc, source) => {
  return acc || source.getFeatureById(id)
}, null)

const addFeature = feature => selection.isSelected(feature.getId())
  ? selected_.addFeature(feature)
  : deselected_.addFeature(feature)

const moveFeature = (from, to) => feature => {
  if (!feature) return
  if (from.hasFeature(feature)) from.removeFeature(feature)
  if (!to.hasFeature(feature)) to.addFeature(feature)
}

source.on('addfeature', ({ feature }) => addFeature(feature))

source.on('removefeature', ({ feature }) => {
  selection.isSelected(feature.getId())
    ? selected_.removeFeature(feature)
    : deselected_.removeFeature(feature)
})

source.getFeatures().forEach(addFeature)

const movetoSelected = moveFeature(deselected_, selected_)
const movetoDeselected = moveFeature(selected_, deselected_)

emitter.on('selection', ({ selected, deselected }) => {
  selected.map(featureById).forEach(movetoSelected)
  deselected.map(featureById).forEach(movetoDeselected)
})
