/**
 * CREDITS: https://github.com/calvinmetcalf/parseDBF
 */

/**
 *
 */
const decodeFileHeader = buffer => {
  return {
    date: new Date(buffer.readUInt8(1) + 1900, buffer.readUInt8(2), buffer.readUInt8(3)),
    numRecords: buffer.readUInt32LE(4),
    headerLength: buffer.readUInt16LE(8),
    recordLength: buffer.readUInt16LE(10)
  }
}


/**
 *
 */
const decodeRowHeaders = (buffer, length, toString) => {
  const headers = []
  var offset = 32

  while (offset < length) {
    headers.push({
      name: toString(buffer.slice(offset, offset + 11)),
      type: String.fromCharCode(buffer.readUInt8(offset + 11)),
      length: buffer.readUInt8(offset + 16),
      decimal: buffer.readUInt8(offset + 17)
    })

    const terminator = buffer.readUInt8(offset + 32)
    if (terminator === 0x0d) break
    else offset += 32
  }

  return headers
}


/**
 *
 */
const decodeValue = (buffer, offset, length, type, toString) => {
  const binary = buffer.slice(offset, offset + length)
  const string = toString(binary)

  switch (type) {
    case 'N':
    case 'F':
    case 'O': return parseFloat(string, 10)
    case 'D': return new Date(string.slice(0, 4), parseInt(string.slice(4, 6), 10) - 1, string.slice(6, 8))
    case 'L': return string.toLowerCase() === 'y' || string.toLowerCase() === 't'
    default: return string
  }
}


/**
 *
 */
const decodeRow = (buffer, offset, rowHeaders, toString) => {
  const fields = {}
  var i = 0
  while (i < rowHeaders.length) {
    const header = rowHeaders[i]
    const value = decodeValue(buffer, offset, header.length, header.type, toString)
    offset += header.length;
    if (value) fields[header.name] = value
    i++
  }

  return fields
}

/**
 *
 */
const decodeRecords = (buffer, fileHeader, rowHeaders, toString) => {
  var offset = ((rowHeaders.length + 1) * 32) + 2
  var count = fileHeader.numRecords
  const records = []

  while (count) {
    records.push(decodeRow(buffer, offset, rowHeaders, toString))
    offset += fileHeader.recordLength
    count -= 1
  }

  return records
}


/**
 *
 */
export const decode = (buffer, toString) => {
  const fileHeader = decodeFileHeader(buffer)
  const rowHeaders = decodeRowHeaders(buffer, fileHeader.headerLength - 1, toString)
  return decodeRecords(buffer, fileHeader, rowHeaders, toString)
}