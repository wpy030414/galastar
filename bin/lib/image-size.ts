/**
 * 读图片尺寸：只为了给 AssetRecord 填 width/height，运行时并不依赖它。
 * 解析失败就返回 null，不猜。
 */
export interface ImageSize {
  width: number
  height: number
}

function pngSize(buf: Uint8Array): ImageSize | null {
  if (buf.length < 24) return null
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) return null
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

function gifSize(buf: Uint8Array): ImageSize | null {
  if (buf.length < 10) return null
  if (buf[0] !== 0x47 || buf[1] !== 0x49 || buf[2] !== 0x46) return null
  const width = buf[6]! | (buf[7]! << 8)
  const height = buf[8]! | (buf[9]! << 8)
  return width && height ? { width, height } : null
}

function jpegSize(buf: Uint8Array): ImageSize | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null
  let offset = 2
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) {
      offset += 1
      continue
    }
    const marker = buf[offset + 1]!
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2
      continue
    }
    const length = (buf[offset + 2]! << 8) | buf[offset + 3]!
    const isSof =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    if (isSof) {
      const height = (buf[offset + 5]! << 8) | buf[offset + 6]!
      const width = (buf[offset + 7]! << 8) | buf[offset + 8]!
      return width && height ? { width, height } : null
    }
    if (length <= 0) return null
    offset += 2 + length
  }
  return null
}

function webpSize(buf: Uint8Array): ImageSize | null {
  if (buf.length < 30) return null
  const tag = String.fromCharCode(buf[0]!, buf[1]!, buf[2]!, buf[3]!)
  const format = String.fromCharCode(buf[8]!, buf[9]!, buf[10]!, buf[11]!)
  if (tag !== 'RIFF' || format !== 'WEBP') return null
  const chunk = String.fromCharCode(buf[12]!, buf[13]!, buf[14]!, buf[15]!)
  if (chunk === 'VP8X') {
    const width = 1 + (buf[24]! | (buf[25]! << 8) | (buf[26]! << 16))
    const height = 1 + (buf[27]! | (buf[28]! << 8) | (buf[29]! << 16))
    return { width, height }
  }
  if (chunk === 'VP8 ') {
    const width = (buf[26]! | (buf[27]! << 8)) & 0x3fff
    const height = (buf[28]! | (buf[29]! << 8)) & 0x3fff
    return width && height ? { width, height } : null
  }
  return null
}

function svgSize(buf: Uint8Array): ImageSize | null {
  const text = new TextDecoder().decode(buf.subarray(0, Math.min(buf.length, 4096)))
  const head = text.slice(0, text.indexOf('>') + 1)
  const width = /\swidth=["']([\d.]+)/i.exec(head)
  const height = /\sheight=["']([\d.]+)/i.exec(head)
  if (width && height) {
    return { width: Math.round(Number(width[1])), height: Math.round(Number(height[1])) }
  }
  const viewBox = /\sviewBox=["']([-\d.]+)[,\s]+([-\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(head)
  if (viewBox) {
    return { width: Math.round(Number(viewBox[3])), height: Math.round(Number(viewBox[4])) }
  }
  return null
}

export function imageSize(buf: Uint8Array, mime: string): ImageSize | null {
  try {
    if (mime === 'image/png') return pngSize(buf)
    if (mime === 'image/gif') return gifSize(buf)
    if (mime === 'image/jpeg') return jpegSize(buf)
    if (mime === 'image/webp') return webpSize(buf)
    if (mime === 'image/svg+xml') return svgSize(buf)
  } catch {
    return null
  }
  return null
}
