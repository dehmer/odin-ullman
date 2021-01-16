import { Translate } from 'ol/interaction'
import emitter from '../../emitter'

const hitTolerance = 3

export default features => {

  const interaction = new Translate({
    hitTolerance,
    features
  })

  interaction.on('translateend', ({ features }) => {
    const geometries = features.getArray().reduce((acc, feature) => {
      acc[feature.getId()] = feature.getGeometry()
      return acc
    }, {})

    emitter.emit('features/geometry/update', { geometries })
  })

  return interaction
}
