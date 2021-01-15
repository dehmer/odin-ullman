import Mousetrap from 'mousetrap'
import Draw from 'ol/interaction/Draw'
import { GeoJSON } from 'ol/format'
import emitter from '../../emitter'
import { drawOptions } from './draw-options'


// TODO: check if singleton could be of use (layers.js:460)
let interaction = null

const unsetInteraction = map => {
  if (!interaction) return
  map.removeInteraction(interaction)
  interaction = null
  // TODO: emit MAP_DRAWEND []
}

const drawstart = descriptor => ({ feature }) => {
  feature.set('sidc', descriptor.sidc)
}

const drawend = (map, options) => ({ feature }) => {
  // NOTE: side-effect may modify feature/geometry
  (options.complete || (() => {}))(map, feature)
  emitter.emit('storage/features/add', { feature })
  unsetInteraction(map)
}

const setInteraction = map => ({ descriptor }) => {
  unsetInteraction(map)

  const options = drawOptions.find(options => options.match(descriptor))
  if (!options) return

  interaction = new Draw(options.options(descriptor))
  if (!interaction) return console.log('undefined draw interaction', descriptor.geometry)
  interaction.on('drawabort', () => unsetInteraction(map))
  interaction.on('drawstart', drawstart(descriptor))
  interaction.on('drawend', drawend(map, options))

  map.addInteraction(interaction)
  map.getTargetElement().focus()
}

export default map => {
  emitter.on('map/draw', setInteraction(map))
  Mousetrap.bind('esc', () => unsetInteraction(map))
}
