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
import { storage } from '../storage'
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
  React.useEffect(() => {
    const target = 'map'
    const controls = [new Rotate()]

    const viewOptions = storage.getItem('session:map.view') || {
      center: [2650758.3877764223, 8019983.4523651665],
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
      style: style('default', deselectedSource)
    })

    const selectedLayer = new VectorLayer({
      source: selectedSource,
      style: style('selected', selectedSource)
    })

    const highlightLayer = new VectorLayer({
      source: new VectorSource({ features: highlightedFeatures }),
      style: highlightStyle
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
      // TODO: throttle
      storage.setItem({
        id: 'session:map.view',
        center: view.getCenter(),
        resolution: view.getResolution(),
        rotation: view.getRotation()
      }, true)
    })

    emitter.on('map/panto', ({ center, resolution }) => view.animate({ center, resolution }))

    emitter.on('selection', () => {
      const selectionCount = selectedSource.getFeatures().length
      deselectedLayer.setOpacity(selectionCount ? 0.35 : 1)
    })
  }, [])

  return <div
    id='map'
    className='map fullscreen'
    tabIndex='0'
  >
  </div>
}
