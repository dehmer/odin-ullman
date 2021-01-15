import { match as exec } from 'path-to-regexp'

const Evented = function () {
}

Evented.prototype.on = function (pattern, handler) {
  this.handlers = this.handlers || {}
  this.handlers[pattern] = this.handlers[pattern] || []
  this.handlers[pattern].push(handler)
}

Evented.prototype.emit = function (path, arg = {}) {
  this.handlers = this.handlers || {}
  const entries = Object.entries(this.handlers)
  if (!entries.length) {
    return console.log('[emitter/emit] no handlers', path)
  }

  const paths = entries.reduce((acc, [pattern, handlers]) => {
    const match = exec(pattern)(path)
    return match ? acc.concat([[match, handlers]]) : acc
  }, [])

  paths.forEach(([match, handlers]) => {
    const event = { ...arg, path: match.path, ...match.params }
    handlers.forEach(handler => handler(event))
  })
}

Evented.prototype.off = function (pattern, handler) {
  if (!pattern) throw new Error('pattern argument undefined')
  if (!handler) throw new Error('handler argument undefined')

  this.handlers = this.handlers || {}
  if (!this.handlers[pattern]) throw new Error(`unknown pattern: ${pattern}`)

  const length = this.handlers[pattern].length
  this.handlers[pattern] = this.handlers[pattern].filter(fn => fn !== handler)
  if (length === this.handlers[pattern].length) throw new Error(`unknown handler: ${handler}`)
}

export default new Evented()
