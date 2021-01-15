import React from 'react'
import ReactDOM from 'react-dom'
import { App } from './App'

// Create root </div> to mount application in:
const root = document.createElement('div')
document.body.appendChild(root)

console.log('root', root)

ReactDOM.render(<App/>, root)
