/**
 * Checksum algorithms: XOR-8, CRC-8, CRC-32.
 */
import type { ChecksumAlgo } from './types'

/** Simple XOR of all bytes. */
export function checksumXor8(data: Uint8Array): number {
  let xor = 0
  for (let i = 0; i < data.length; i++) {
    xor ^= data[i]
  }
  return xor & 0xff
}

// CRC-8 (polynomial 0x07 — CRC-8/CCITT)
const crc8Table = new Uint8Array(256)
;(function buildCrc8Table() {
  for (let i = 0; i < 256; i++) {
    let crc = i
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x80 ? (crc << 1) ^ 0x07 : crc << 1
    }
    crc8Table[i] = crc & 0xff
  }
})()

export function checksumCrc8(data: Uint8Array): number {
  let crc = 0
  for (let i = 0; i < data.length; i++) {
    crc = crc8Table[(crc ^ data[i]) & 0xff]
  }
  return crc
}

// CRC-32 (ISO 3309 / ITU-T V.42)
const crc32Table = new Uint32Array(256)
;(function buildCrc32Table() {
  for (let i = 0; i < 256; i++) {
    let crc = i
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
    }
    crc32Table[i] = crc >>> 0
  }
})()

export function checksumCrc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc = crc32Table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

/** Compute checksum using the specified algorithm. */
export function computeChecksum(data: Uint8Array, algo: ChecksumAlgo): number {
  switch (algo) {
    case 'xor8':
      return checksumXor8(data)
    case 'crc8':
      return checksumCrc8(data)
    case 'crc32':
      return checksumCrc32(data)
    case 'none':
      return 0
  }
}

/** Verify a block's checksum against an expected value. */
export function verifyBlock(
  data: Uint8Array,
  expected: number,
  algo: ChecksumAlgo,
): boolean {
  if (algo === 'none') return true
  return computeChecksum(data, algo) === expected
}
