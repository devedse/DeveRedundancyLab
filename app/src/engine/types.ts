/* Shared types for the RAID / erasure-coding engine */

export type Algorithm = 'raid5' | 'raid6' | 'reed-solomon'

export type ChecksumAlgo = 'none' | 'xor8' | 'crc8' | 'crc32'

export type DiskRole = 'data' | 'parity-p' | 'parity-q'

export type DiskStatus =
  | 'healthy'
  | 'failed'
  | 'degraded'
  | 'rebuilding'
  | 'corrupted'
  | 'empty'

export interface StripeUnit {
  diskIndex: number
  offset: number
  pixels: Uint8Array
  role: DiskRole
}

export interface StripeLayout {
  /** Which disk index holds parity-P for this stripe */
  parityP: number
  /** Which disk index holds parity-Q for this stripe (RAID 6 / RS only) */
  parityQ?: number
  /** Ordered data-disk indices for this stripe */
  dataDisks: number[]
}
