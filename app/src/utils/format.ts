/** Hex/binary formatting helpers. */

export function toHex(value: number, pad = 2): string {
  return '0x' + value.toString(16).toUpperCase().padStart(pad, '0')
}

export function toBinary(value: number, bits = 8): string {
  return value.toString(2).padStart(bits, '0')
}

export function toSubscript(n: number): string {
  const digits = '₀₁₂₃₄₅₆₇₈₉'
  return String(n)
    .split('')
    .map(d => digits[parseInt(d)])
    .join('')
}
