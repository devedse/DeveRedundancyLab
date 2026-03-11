/**
 * 8-bit RGB palette (3R/3G/2B).
 *
 * Value 0x00–0xFF maps to a specific RGB color:
 *   R = ((value >> 5) & 0x07) * 36   → 0–252
 *   G = ((value >> 2) & 0x07) * 36   → 0–252
 *   B = ((value)      & 0x03) * 85   → 0, 85, 170, 255
 */

export function byteToRgb(value: number): [r: number, g: number, b: number] {
  const r = ((value >> 5) & 0x07) * 36
  const g = ((value >> 2) & 0x07) * 36
  const b = (value & 0x03) * 85
  return [r, g, b]
}

export function byteToCssColor(value: number): string {
  const [r, g, b] = byteToRgb(value)
  return `rgb(${r}, ${g}, ${b})`
}

/**
 * Convert an RGB pixel to the nearest 8-bit palette index.
 */
export function rgbToByte(r: number, g: number, b: number): number {
  const rq = Math.round(r / 36) & 0x07
  const gq = Math.round(g / 36) & 0x07
  const bq = Math.round(b / 85) & 0x03
  return (rq << 5) | (gq << 2) | bq
}
