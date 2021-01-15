import { Select } from 'ol/interaction'
import { click, platformModifierKeyOnly } from 'ol/events/condition'
import style from '../style'
import selection from '../../selection'

const hitTolerance = 3
const noAltKey = ({ originalEvent }) => originalEvent.altKey !== true // macOS: option key
const conjunction = (...ps) => v => ps.reduce((acc, p) => acc && p(v), true)


/**
 *
 */
export default (deselectedLayer, selectedLayer) => {
  const selectedSource = selectedLayer.getSource()

  const interaction = new Select({
    hitTolerance,
    layers: [deselectedLayer, selectedLayer],
    style: (feature, resolution) => {
      const fn = interaction.getFeatures().getLength() < 2
        ? style('selected')
        : style('multi')
      return fn(feature, resolution)
    },
    condition: conjunction(click, noAltKey),
    toggleCondition: platformModifierKeyOnly, // macOS: command
    multi: false // don't select all features under cursor at once.
  })

  interaction.on('select', () => {
    // Propagate to global selection.
    // NOTE: selected, deselected are deltas/changes.
    const ids = features => features.map(feature => feature.getId())
    selection.set(ids(interaction.getFeatures().getArray()))
  })

  selectedSource.on('addfeature', ({ feature }) => {
    const features = interaction.getFeatures().getArray()
    if (!features.includes(feature)) interaction.getFeatures().push(feature)
  })

  selectedSource.on('removefeature', ({ feature }) => {
    const features = interaction.getFeatures().getArray()
    if (features.includes(feature)) interaction.getFeatures().remove(feature)
  })

  return interaction
}
