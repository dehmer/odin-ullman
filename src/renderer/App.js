import React from 'react'

export const App = props => {
  return <div>{JSON.stringify(process.versions, null, 2)}</div>
}
