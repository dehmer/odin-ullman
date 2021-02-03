import { Transform } from 'stream'
import { ByteBuffer, UnderflowError } from './bytebuffer.js'

export const decoder = fn => new Transform({
  objectMode: true,
  transform(chunk, _, next) {
    this.acc = this.acc || ByteBuffer.empty()
    if(Buffer.isBuffer(chunk)) this.acc.append(chunk).shrink()
    else return this.push(chunk), next()

    while(this.acc.remaining()) {
      try {
        this.acc.mark()
        fn(this.acc, chunk => this.push(chunk))
      }
      catch(err) {
        if(err instanceof UnderflowError) return this.acc.reset(), next()
        else if(err instanceof RangeError) return this.acc.reset(), next()
        // see: https://nodejs.org/api/stream.html#stream_errors_while_writing
        else return next(err)
      }
    }
    next()
  }
})
