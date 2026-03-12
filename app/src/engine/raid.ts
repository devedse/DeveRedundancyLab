/**
 * RAID 5 and RAID 6 stripe layout and parity computation.
 */
import { gfAdd, gfMul, gfPow } from './gf256'
import type { StripeLayout, StripeUnit } from './types'

/**
 * Compute RAID 5 stripe layout (fixed parity on last disk).
 * Parity always sits on disk N-1 for easier visualization.
 */
export function raid5Layout(totalDisks: number, _stripeIndex: number): StripeLayout {
  const parityP = totalDisks - 1
  const dataDisks: number[] = []
  for (let d = 0; d < totalDisks; d++) {
    if (d !== parityP) dataDisks.push(d)
  }
  return { parityP, dataDisks }
}

/**
 * Compute RAID 6 stripe layout (fixed parity on last two disks).
 * P on disk N-2, Q on disk N-1 for easier visualization.
 */
export function raid6Layout(totalDisks: number, _stripeIndex: number): StripeLayout {
  const parityP = totalDisks - 2
  const parityQ = totalDisks - 1
  const dataDisks: number[] = []
  for (let d = 0; d < totalDisks; d++) {
    if (d !== parityP && d !== parityQ) dataDisks.push(d)
  }
  return { parityP, parityQ, dataDisks }
}

/**
 * Compute XOR parity (RAID 5 P parity) for a set of data blocks.
 * All blocks must have the same length.
 * Returns a new Uint8Array of the same length.
 */
export function computeXorParity(dataBlocks: Uint8Array[]): Uint8Array {
  const len = dataBlocks[0].length
  const parity = new Uint8Array(len)
  for (const block of dataBlocks) {
    for (let i = 0; i < len; i++) {
      parity[i] ^= block[i]
    }
  }
  return parity
}

/**
 * Compute RAID 6 Q syndrome using GF(2⁸) weighted sum.
 * Q[i] = Σ (g^j · dataBlocks[j][i])  for j = 0..n-1
 * where g = 2 (the generator).
 */
export function computeQSyndrome(dataBlocks: Uint8Array[]): Uint8Array {
  const len = dataBlocks[0].length
  const q = new Uint8Array(len)
  for (let j = 0; j < dataBlocks.length; j++) {
    const coeff = gfPow(2, j) // g^j
    for (let i = 0; i < len; i++) {
      q[i] = gfAdd(q[i], gfMul(coeff, dataBlocks[j][i]))
    }
  }
  return q
}

/**
 * Build a full RAID 5 stripe: assigns data blocks to the layout and computes parity.
 */
export function computeRaid5Stripe(
  dataBlocks: Uint8Array[],
  stripeIndex: number,
  totalDisks: number,
): StripeUnit[] {
  const layout = raid5Layout(totalDisks, stripeIndex)
  const blockSize = dataBlocks[0].length
  const units: StripeUnit[] = []

  // Place data blocks
  for (let i = 0; i < layout.dataDisks.length; i++) {
    units.push({
      diskIndex: layout.dataDisks[i],
      offset: stripeIndex * blockSize,
      pixels: dataBlocks[i],
      role: 'data',
    })
  }

  // Compute and place parity
  const parity = computeXorParity(dataBlocks)
  units.push({
    diskIndex: layout.parityP,
    offset: stripeIndex * blockSize,
    pixels: parity,
    role: 'parity-p',
  })

  return units
}

/**
 * Build a full RAID 6 stripe: data + P (XOR) + Q (GF weighted sum).
 */
export function computeRaid6Stripe(
  dataBlocks: Uint8Array[],
  stripeIndex: number,
  totalDisks: number,
): StripeUnit[] {
  const layout = raid6Layout(totalDisks, stripeIndex)
  const blockSize = dataBlocks[0].length
  const units: StripeUnit[] = []

  for (let i = 0; i < layout.dataDisks.length; i++) {
    units.push({
      diskIndex: layout.dataDisks[i],
      offset: stripeIndex * blockSize,
      pixels: dataBlocks[i],
      role: 'data',
    })
  }

  units.push({
    diskIndex: layout.parityP,
    offset: stripeIndex * blockSize,
    pixels: computeXorParity(dataBlocks),
    role: 'parity-p',
  })

  units.push({
    diskIndex: layout.parityQ!,
    offset: stripeIndex * blockSize,
    pixels: computeQSyndrome(dataBlocks),
    role: 'parity-q',
  })

  return units
}
