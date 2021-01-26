import React from 'react'
import 'ol/ol.css'
import * as ol from 'ol'
import { OSM } from 'ol/source'
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer'
import VectorSource from 'ol/source/Vector'
import { Rotate } from 'ol/control'
import { Fill, Stroke, Circle, Style } from 'ol/style'
import { defaults as defaultInteractions } from 'ol/interaction'
import { highlightedFeatures } from '../storage/action'
import './epsg'
import style from './style'
import * as level from '../storage/level'
import select from './interaction/select'
import boxselect from './interaction/boxselect'
import translate from './interaction/translate'
import draw from './interaction/draw'
import modify from './interaction/modify'
import { deselectedSource, selectedSource } from './partition'
import emitter from '../emitter'


/**
 *
 */
export const Map = () => {
  React.useEffect(async () => {
    const target = 'map'
    const controls = [new Rotate()]

    const viewOptions = await level.value('session:map.view') || {
      center: [1823376.75753279, 6143598.472197734], // Vienna
      resolution: 612,
      rotation: 0
    }

    const fill = new Fill({ color: 'rgba(255,50,50,0.4)' })
    const stroke = new Stroke({ color: 'black', width: 1, lineDash: [10, 5] })
    const highlightStyle = [
      new Style({
        image: new Circle({ fill: fill, stroke: stroke, radius: 50 }),
        fill: fill,
        stroke: stroke
      })
    ]

    const deselectedLayer = new VectorLayer({
      source: deselectedSource,
      style: style('default', deselectedSource),
      updateWhileAnimating: true
    })

    const selectedLayer = new VectorLayer({
      source: selectedSource,
      style: style('selected', selectedSource),
      updateWhileAnimating: true
    })

    const highlightLayer = new VectorLayer({
      source: new VectorSource({ features: highlightedFeatures }),
      style: highlightStyle,
      updateWhileAnimating: true
    })

    const view = new ol.View(viewOptions)
    const layers = [
      new TileLayer({ source: new OSM() }),
      deselectedLayer,
      selectedLayer,
      highlightLayer
    ]

    const map = new ol.Map({
      target,
      controls,
      layers,
      view,
      interactions: defaultInteractions({
        doubleClickZoom: false
      })
    })

    const selectInteraction = select(deselectedLayer, selectedLayer)
    map.addInteraction(selectInteraction)
    map.addInteraction(boxselect([deselectedSource, selectedSource]))
    map.addInteraction(translate(selectInteraction.getFeatures()))
    draw(map)
    map.addInteraction(modify(selectInteraction.getFeatures()))

    view.on('change', ({ target: view }) => {
      level.put({
        id: 'session:map.view',
        center: view.getCenter(),
        resolution: view.getResolution(),
        rotation: view.getRotation()
      }, { quiet: true })
    })

    emitter.on('map/panto', ({ center, resolution, rotation }) => view.animate({
      center,
      resolution,
      rotation,
      duration: 100
    }))

    emitter.on('selection', () => {
      const selectionCount = selectedSource.getFeatures().length
      deselectedLayer.setOpacity(selectionCount ? 0.35 : 1)
    })

    emitter.on('project/open', async () => {
      const options = await level.value('session:map.view')
      if (!options) return
      view.setCenter(options.center)
      view.setResolution(options.resolution)
      view.setRotation(options.rotation)
    })

  }, [])

  return <div
    id='map'
    className='map fullscreen'
    tabIndex='0'
  >
  </div>
}
