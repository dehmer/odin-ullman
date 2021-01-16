import * as R from 'ramda'
import { DragBox } from 'ol/interaction'
import { platformModifierKeyOnly } from 'ol/events/condition'
import selection from '../../selection'

/**
 *
 */
export default sources => {

  const featureById = id => sources.reduce((acc, source) => {
    return acc || source.getFeatureById(id)
  }, null)

  // Note: DragBox is not a selection interaction per se.
  // I.e. it does not manage selected features automatically.
  const interaction = new DragBox({
    condition: platformModifierKeyOnly
  })

  interaction.on('boxend', () => {

    // NOTE: Map rotation is not supported, yet.
    // See original source for implementation:
    // https://openlayers.org/en/latest/examples/box-selection.html

    // Collect features intersecting extent.
    const extent = interaction.getGeometry().getExtent()
    const features = sources.reduce((acc, source) => acc.concat(source.getFeaturesInExtent(extent)), [])

    // Toggle selections:
    const isSelected = feature => selection.isSelected(feature.getId())
    const [removals, additions] = R.partition(isSelected)(features)
    selection.deselect(removals.map(feature => feature.getId()))
    selection.deselect(selection.selected(id => !featureById(id))) // not on map
    selection.select(additions.map(feature => feature.getId()))
  })

  return interaction
}
