/**
 * Galois Field GF(2⁸) arithmetic with configurable primitive polynomial.
 *
 * Default polynomial: 0x11D  (x⁸ + x⁴ + x³ + x² + 1)
 * All operations return values in [0, 255].
 */

const FIELD_SIZE = 256

let logTable: Uint8Array
let expTable: Uint8Array
let currentPoly = 0

/**
 * Build log / exp lookup tables for O(1) multiply & divide.
 * Must be called before any mul/div/inv operations.
 */
export function buildLogTables(primPoly: number = 0x11d): void {
  if (primPoly === currentPoly) return
  currentPoly = primPoly

  logTable = new Uint8Array(FIELD_SIZE)
  expTable = new Uint8Array(FIELD_SIZE)

  let x = 1
  for (let i = 0; i < 255; i++) {
    expTable[i] = x
    logTable[x] = i
    x <<= 1
    if (x & 0x100) {
      x ^= primPoly
    }
  }
  // expTable[255] is not used for log purposes but fill for safety
  expTable[255] = expTable[0]
}

/** GF addition (and subtraction) — just XOR. */
export function gfAdd(a: number, b: number): number {
  return a ^ b
}

/** GF subtraction — identical to addition in GF(2ⁿ). */
export const gfSub = gfAdd

/** GF multiplication via log/exp tables. */
export function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0
  return expTable[(logTable[a] + logTable[b]) % 255]
}

/** GF division: a / b = a * b⁻¹. Throws if b === 0. */
export function gfDiv(a: number, b: number): number {
  if (b === 0) throw new RangeError('Division by zero in GF(2⁸)')
  if (a === 0) return 0
  return expTable[(logTable[a] - logTable[b] + 255) % 255]
}

/** Multiplicative inverse of a in GF(2⁸). */
export function gfInverse(a: number): number {
  if (a === 0) throw new RangeError('Zero has no inverse in GF(2⁸)')
  return expTable[(255 - logTable[a]) % 255]
}

/** GF exponentiation: a^n. */
export function gfPow(a: number, n: number): number {
  if (n === 0) return 1
  if (a === 0) return 0
  return expTable[(logTable[a] * n) % 255]
}

/** Get current log table (for inspector display). */
export function getLogTable(): Uint8Array {
  return logTable
}

/** Get current exp table (for inspector display). */
export function getExpTable(): Uint8Array {
  return expTable
}

// Initialize with default polynomial
buildLogTables()
