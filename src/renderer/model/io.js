import * as R from 'ramda'

const loadLayerFile = file => new Promise((resolve, reject) => {
  const layername = filename => R.dropLast(5, filename) // '.json'
  const reader = new FileReader()

  reader.onload = ({ target }) => {
    if (target.error) return reject(target.error)
    const layer = JSON.parse(target.result)
    layer.name = layername(file.name)
    layer.features.forEach(feature => delete feature.title)
    resolve(layer)
  }

  reader.readAsText(file)
})

export const loadLayerFiles = async files =>
  Promise.all(files.map(loadLayerFile))
