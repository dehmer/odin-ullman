export function UnderflowError(message) {
  Error.captureStackTrace(this, this.constructor)
  this.name = this.constructor.name
  this.message = message
}

/**
 * Wraps Buffer object and keeps track of current offset.
 */
export class ByteBuffer {
  constructor(buffer) {
    if(!buffer) throw new ReferenceError('buffer')
    if(!(buffer instanceof Buffer)) throw new TypeError('buffer')

    this.buffer = buffer
    this.offset = 0 // 0 .. n-1
  }

  length()    { return this.buffer.length }
  remaining() { return this.buffer.length - this.offset }

  mark() {
    this.marker = this.offset
    return this
  }

  reset() {
    if(this.marker || this.marker === 0) this.offset = this.marker
    delete this.marker
    return this
  }

  skip(len) {
    if(len < 0) throw new RangeError('len')
    if(len === 0) return

    if(this.remaining() < len) throw new UnderflowError()
    this.offset += ((len > 0) ? len : 0)
    return this
  }

  append(buf) {
    this.buffer = Buffer.concat([this.buffer, buf], this.buffer.length + buf.length)
    return this
  }

  shrink() {
    // Adjust marker if set:
    if(this.marker) this.marker -= this.offset
    this.buffer = this.buffer.slice(this.offset)
    this.offset = 0
    return this
  }

  int32BE() {
    const v = this.buffer.readInt32BE(this.offset)
    this.offset += 4
    return v
  }

  int32LE() {
    const v = this.buffer.readInt32LE(this.offset)
    this.offset += 4
    return v
  }

  doubleLE() {
    const v = this.buffer.readDoubleLE(this.offset)
    this.offset += 8
    return v
  }


  fixed(len) {
    if(len < 0) throw new RangeError('len')
    if(len === 0) return ''
    if(!len) throw new ReferenceError('len')
    if(this.remaining() < len) throw new UnderflowError()

    const s = this.buffer.toString('ascii', this.offset, this.offset + len)
    this.offset += len
    return s
  }

  delimited(delim, escape) {
    const indexOf = offset => {
      const index = this.buffer.indexOf(delim, offset)
      if(index === -1) throw new UnderflowError()
      return index
    }

    var offset = this.offset
    while(true) {
      const index = indexOf(offset)

      // Look back to see if delimiter was escaped:
      if(index > 0 && this.buffer.toString('ascii', index - 1, index) === escape) {
        offset = index + 1
        continue
      }

      const s = this.buffer.toString('ascii', this.offset, index)
      this.offset = index + 1
      return s
    }
  }
}

ByteBuffer.empty = function() {
  return new ByteBuffer(Buffer.alloc(0))
}

ByteBuffer.fromString = function(string, encoding) {
  return new ByteBuffer(Buffer.from(string, encoding))
}

ByteBuffer.utf8 = function(string) {
  return new ByteBuffer(Buffer.from(string))
}
