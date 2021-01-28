import React from 'react'
import 'antd/dist/antd.css'
import { Input } from 'antd'
import { Select } from 'antd'
import { Checkbox } from 'antd'
import { Button } from 'antd'
import { Radio } from 'antd'
import emitter from '../emitter'

const { Option } = Select

const Text = React.memo(props => {
  const [value, setValue] = React.useState(props.value || '')

  const handleChange = ({ target }) => setValue(target.value)
  const handleBlur = () => {
    emitter.emit(`${props.id}/update`, { ids: props.ids, property: props.property, value })
  }

  const handleKeyDown = event => {
    if (event.key === 'a' && event.metaKey) event.stopPropagation()
    else if (event.key === ' ') event.stopPropagation()
  }

  return <Input
    value={value}
    addonBefore={props.label}
    onChange={handleChange}
    onBlur={handleBlur}
    onKeyDown={handleKeyDown}
  />
})

const ComboBox = React.memo(props => {
  const [value, setValue] = React.useState(props.value || '')

  const handleChange = (value) => {
    setValue(value)
    const event = { ids: props.ids, property: props.property, value}
    emitter.emit(`${props.id}/update`, event)
  }

  const items = props.options.map(option => {
    return <Option key={option[1]} value={option[1]}>{option[0]}</Option>
  })

  return <Input.Group compact>
    <Input
      disabled
      value='Echelon'
      style={{ width: '25%', color: 'rgba(0, 0, 0, 0.85)', cursor: 'auto', backgroundColor: '#fafafa' }}
    />
    <Select
      defaultValue={value}
      onChange={handleChange}
      style={{ width: '75%' }}
    >
      { items }
    </Select>
  </Input.Group>
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

  const decode = value => {
    switch (value) {
      case 'G': return ['P', true]
      case 'W': return ['U', true]
      case 'M': return ['A', true]
      case 'D': return ['F', true]
      case 'L': return ['N', true]
      default: return [value, false]
    }
  }

  const encode = (value, checked) => {
    if (!checked) return value
    else if (value === 'P') return 'G'
    else if (value === 'U') return 'W'
    else if (value === 'A') return 'M'
    else if (value === 'F') return 'D'
    else if (value === 'N') return 'L'
  }

  const initial = decode(props.value || 'F')
  const [select, setSelect] = React.useState(initial[0])
  const [exerciseChecked, setExerciseChecked] = React.useState(initial[1])

  const handleChange = value => {
    setSelect(value)
    const theValue = encode(value, exerciseChecked)
    const event = { ids: props.ids, property: props.property, value: theValue }
    emitter.emit(`${props.id}/update`, event)
  }

  const handleExcerciseChange = ({ target }) => {
    setExerciseChecked(target.checked)
    const theValue = encode(select, target.checked)
    const event = { ids: props.ids, property: props.property, value: theValue }
    emitter.emit(`${props.id}/update`, event)
  }

  return <Input.Group compact>
    <Input
      disabled
      value='Hostility'
      style={{ width: '25%', color: 'rgba(0, 0, 0, 0.85)', cursor: 'auto', backgroundColor: '#fafafa' }}
    />
    <Select
      defaultValue={select}
      onChange={handleChange}
      style={{ width: '55%' }}
    >
      <Option value='P'>Pending</Option>
      <Option value='U'>Unknown</Option>
      <Option value='A'>Assumed Friend</Option>
      <Option value='F'>Friend</Option>
      <Option value='N'>Neutral</Option>
      <Option value='S'>Suspect</Option>
      <Option value='H'>Hostile</Option>
      <Option value='J'>Joker</Option>
      <Option value='K'>Faker</Option>
    </Select>
    <Checkbox
      onChange={handleExcerciseChange}
      checked={exerciseChecked}
      style={{ paddingLeft: '12px', paddingTop: '4px' }}
    >
      Ex.
    </Checkbox>
  </Input.Group>
})

const Modifiers = props => {

  const decode = value => {
    switch (value) {
      case 'F': return [false, false, true]
      case 'E': return [false, true, false]
      case 'G': return [false, true, true]
      case 'A': return [true, false, false]
      case 'C': return [true, false, true]
      case 'B': return [true, true, false]
      case 'D': return [true, true, true]
      default: return [false, false, false]
    }
  }

  const encode = state => {
    if (!state[0] && !state[1] && !state[2]) return '*'
    else if (!state[0] && !state[1] && state[2]) return 'F'
    else if (!state[0] && state[1] && !state[2]) return 'E'
    else if (!state[0] && state[1] && state[2]) return 'G'
    else if (state[0] && !state[1] && !state[2]) return 'A'
    else if (state[0] && !state[1] && state[2]) return 'C'
    else if (state[0] && state[1] && !state[2]) return 'B'
    else if (state[0] && state[1] && state[2]) return 'D'
  }

  const handleClick = index => () => {
    const clone = [...state]
    clone[index] = !clone[index]
    setState(clone)
    const event = { ids: props.ids, property: props.property, value: encode(clone) }
    emitter.emit(`${props.id}/update`, event)
  }

  const labels = ['HQ', 'TF', 'F/D']
  const [state, setState] = React.useState(decode(props.value))
  const buttons = state.map((flag, index) => <Button
    key={index}
    style={{ width: '25%' }}
    type={flag ? 'primary' : 'default'}
    onClick={handleClick(index)}>
      {labels[index]}
  </Button>)

  return <Input.Group compact>
    <Input
      disabled
      value='Modifiers'
      style={{ width: '25%', color: 'rgba(0, 0, 0, 0.85)', cursor: 'auto', backgroundColor: '#fafafa' }}
    />
    { buttons }
  </Input.Group>
}

/**
 * Reinforced/reduced.
 */
const Assignment = props => {

  const [value, setValue] = React.useState(props.value)

  const handleChange = ({ target }) => {
    setValue(target.value)
    const event = { ids: props.ids, property: props.property, value: target.value }
    emitter.emit(`${props.id}/update`, event)
  }

  return <Input.Group compact>
    <Input
      disabled
      value='Reinforced'
      style={{ width: '30%', color: 'rgba(0, 0, 0, 0.85)', cursor: 'auto', backgroundColor: '#fafafa' }}
    />
    <Radio.Group defaultValue={value} buttonStyle="solid" onChange={handleChange}>
      <Radio.Button value="">None</Radio.Button>
      <Radio.Button value="(+)">(+)</Radio.Button>
      <Radio.Button value="(-)">(-)</Radio.Button>
      <Radio.Button value="(±)">(±)</Radio.Button>
    </Radio.Group>
  </Input.Group>
}

/**
 * Mobility Indicator
 */
const Mobility = props => {
  const [value, setValue] = React.useState(props.value)

  const handleChange = value => {
    setValue(value)
    const event = { ids: props.ids, property: props.property, value: value }
    emitter.emit(`${props.id}/update`, event)
  }

  return <Input.Group compact>
    <Input
      disabled
      value={props.label}
      style={{ width: '25%', color: 'rgba(0, 0, 0, 0.85)', cursor: 'auto', backgroundColor: '#fafafa' }}
    />
    <Select
      defaultValue={value}
      onChange={handleChange}
      style={{ width: '75%' }}
    >
      <Option value='--'>N/A</Option>
      <Option value='MO'>Wheeled</Option>
      <Option value='MP'>Cross Country</Option>
      <Option value='MQ'>Tracked</Option>
      <Option value='MR'>Wheeled/Tracked</Option>
      <Option value='MS'>Towed</Option>
      <Option value='MT'>Rail</Option>
      <Option value='MU'>Over the Snow</Option>
      <Option value='MV'>Sled</Option>
      <Option value='MW'>Pack Animals</Option>
      {/*
        Possibly wrong in milsymbol (Barge: MX, Amphibious: MY)
        see https://github.com/spatialillusions/milsymbol/issues/224
      */}
      <Option value='MY'>Barge</Option>
      <Option value='MZ'>Amphibious</Option>
    </Select>
  </Input.Group>
}

const Status = props => {

  const [value, setValue] = React.useState(props.value)

  const handleChange = ({ target }) => {
    setValue(target.value)
    const event = { ids: props.ids, property: props.property, value: target.value }
    emitter.emit(`${props.id}/update`, event)
  }

  return <Input.Group compact>
    <Input
      disabled
      value='Status'
      style={{ width: '25%', color: 'rgba(0, 0, 0, 0.85)', cursor: 'auto', backgroundColor: '#fafafa' }}
    />
    <Radio.Group defaultValue={value} buttonStyle="solid" onChange={handleChange}>
      <Radio.Button value="P">Present</Radio.Button>
      <Radio.Button value="A">Anticipated/Planned</Radio.Button>
    </Radio.Group>
  </Input.Group>
}

/**
 *
 */
const OperationalCondition = props => {

  const [value, setValue] = React.useState(props.value)

  const handleChange = value => {
    setValue(value)
    const event = { ids: props.ids, property: props.property, value }
    emitter.emit(`${props.id}/update`, event)
  }

  return <Input.Group compact>
    <Input
      disabled
      value='Status'
      style={{ width: '25%', color: 'rgba(0, 0, 0, 0.85)', cursor: 'auto', backgroundColor: '#fafafa' }}
    />
    <Select
      style={{ width: '75%' }}
      defaultValue={value}
      onChange={handleChange}
    >
      <Option value='P'>Present</Option>
      <Option value='A'>Anticipated</Option>
      <Option value='C'>Fully Capable</Option>
      <Option value='D'>Damaged</Option>
      <Option value='X'>Destroyed</Option>
      <Option value='F'>Full to Capacity</Option>
    </Select>
  </Input.Group>
}

const Property = props => {
  const component = (type => {
    switch (type) {
      case 'text': return <Text {...props}/>
      case 'select': return <ComboBox {...props}/>
      case 'identity': return <Identity {...props}/>
      case 'modifiers': return <Modifiers {...props}/>
      case 'assignment': return <Assignment {...props}/>
      case 'mobility': return <Mobility {...props}/>
      case 'status': return <Status {...props}/>
      case 'opcon': return <OperationalCondition {...props}/>
      default: return <Text {...props}/>
    }
  })(props.type)

  return <div className='property'>
    { component }
  </div>
}

export default React.memo(Property)
