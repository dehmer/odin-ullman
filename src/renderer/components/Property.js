import React from 'react'
import TextField from '@material-ui/core/TextField'
import { Select as MuiSelect, MenuItem, InputLabel, Checkbox } from '@material-ui/core'
import { FormControl, FormControlLabel } from '@material-ui/core'

import emitter from '../emitter'

const Text = React.memo(props => {
  const [value, setValue] = React.useState(props.value || '')

  const handleChange = ({ target }) => setValue(target.value)
  const handleBlur = () => {
    if (value === (props.value || '')) return
    emitter.emit(`${props.id}/update`, { ids: props.ids, property: props.property, value })
  }

  const handleKeyDown = event => {
    if (event.key === 'a' && event.metaKey) event.stopPropagation()
    else if (event.key === ' ') event.stopPropagation()
  }

  return <TextField
    fullWidth={true}
    variant='outlined'
    size='small'
    key={props.id}
    label={props.label}
    value={value}
    onChange={handleChange}
    onBlur={handleBlur}
    onKeyDown={handleKeyDown}
  />
})

const Select = React.memo(props => {
  const [value, setValue] = React.useState(props.value || '')

  const handleChange = ({ target }) => {
    setValue(target.value)
    const event = { ids: props.ids, property: props.property, value: target.value }
    emitter.emit(`${props.id}/update`, event)
  }

  const items = props.options.map(option => {
    return <MenuItem key={option[1]} value={option[1]}>{option[0]}</MenuItem>
  })

  return (
    <FormControl fullWidth={true}>
      <InputLabel shrink>{props.label}</InputLabel>
      <MuiSelect
        size='small'
        value={value}
        onChange={handleChange}
      >
        { items }
      </MuiSelect>
    </FormControl>
  )
})

const Identity = React.memo(props => {

  // P-PENDING         G-EXCERCISE
  // U-UNKNOWN         W-EXCERCISE
  // A-ASSUMED FRIEND  M-EXCERCISE
  // F-FRIEND          D-EXCERCISE
  // N-NEUTRAL         L-EXCERCISE
  // S-SUSPECT         N/A
  // H-HOSTILE         N/A
  // J-JOKER           N/A
  // K-FAKER           N/A

  const values = value => {
    switch (value) {
      case 'G': return ['P', true]
      case 'W': return ['U', true]
      case 'M': return ['A', true]
      case 'D': return ['F', true]
      case 'L': return ['N', true]
      default: return [value, false]
    }
  }

  const value = (value, checked) => {
    if (!checked) return value
    else if (value === 'P') return 'G'
    else if (value === 'U') return 'W'
    else if (value === 'A') return 'M'
    else if (value === 'F') return 'D'
    else if (value === 'N') return 'L'
  }

  const initial = values(props.value || 'F')
  const [select, setSelect] = React.useState(initial[0])
  const [exerciseChecked, setExerciseChecked] = React.useState(initial[1])

  const handleChange = ({ target }) => {
    setSelect(target.value)
    const theValue = value(target.value, exerciseChecked)
    const event = { ids: props.ids, property: props.property, value: theValue }
    emitter.emit(`${props.id}/update`, event)
  }

  const handleExcerciseChange = ({ target }) => {
    setExerciseChecked(target.checked)
    const theValue = value(select, target.checked)
    const event = { ids: props.ids, property: props.property, value: theValue }
    emitter.emit(`${props.id}/update`, event)
  }

  return (
    <FormControl>
      <InputLabel shrink>Hostility</InputLabel>
      <MuiSelect
        size='small'
        value={select}
        onChange={handleChange}
      >
        <MenuItem value='P'>Pending</MenuItem>
        <MenuItem value='U'>Unknown</MenuItem>
        <MenuItem value='A'>Assumed Friend</MenuItem>
        <MenuItem value='F'>Friend</MenuItem>
        <MenuItem value='N'>Neutral</MenuItem>
        <MenuItem value='S'>Suspect</MenuItem>
        <MenuItem value='H'>Hostile</MenuItem>
        <MenuItem value='J'>Joker</MenuItem>
        <MenuItem value='K'>Faker</MenuItem>
      </MuiSelect>
      <FormControlLabel
        label="Excercise"
        control={
          <Checkbox
            color="secondary"
            checked={exerciseChecked}
            onChange={handleExcerciseChange}
          />
        }
      />
    </FormControl>
  )
})

const Property = React.forwardRef((props, ref) => {
  const component = (type => {
    switch (type) {
      case 'text': return <Text {...props}/>
      case 'select': return <Select {...props}/>
      case 'identity': return <Identity {...props}/>
      default: return <Text {...props}/>
    }
  })(props.type)

  return (
    <div className='property'>
      { component }
    </div>
  )
})

export default React.memo(Property)
