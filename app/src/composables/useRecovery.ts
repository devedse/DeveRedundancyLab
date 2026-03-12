/**
 * Recovery composable: reads data back from disk array, reconstructs missing
 * data from parity, and handles disk rebuild operations.
 */
import { useVolumeStore } from '@/stores/volume'
import { useDiskStore } from '@/stores/disks'
import { useImageStore } from '@/stores/images'
import { raid5Layout, raid6Layout, computeXorParity, computeQSyndrome } from '@/engine/raid'
import { reconstruct as rsReconstruct, encode as rsEncode } from '@/engine/reedsolomon'
import { gfAdd, gfMul, gfDiv, gfPow } from '@/engine/gf256'

/**
 * Read all data pixels back from disks in stripe order, using null for
 * failed/missing disk data. Returns { onDisk, reconstructed } pixel arrays.
 */
export function readVolumePixels(): {
  onDisk: Uint8Array
  reconstructed: Uint8Array
  stats: { total: number; matching: number; missing: number; corrupted: number }
} {
  const volume = useVolumeStore()
  const diskStore = useDiskStore()
  const imageStore = useImageStore()

  const image = imageStore.images.find(img => img.id === volume.sourceImageId)
  if (!image) {
    return {
      onDisk: new Uint8Array(0),
      reconstructed: new Uint8Array(0),
      stats: { total: 0, matching: 0, missing: 0, corrupted: 0 },
    }
  }

  const { dataDisks, blockSize, algorithm } = volume
  const totalPixels = image.width * image.height
  const pixelsPerStripe = dataDisks * blockSize
  const stripeCount = Math.ceil(totalPixels / pixelsPerStripe)

  const onDisk = new Uint8Array(totalPixels)
  const reconstructed = new Uint8Array(totalPixels)
  let matching = 0
  let missing = 0
  let corrupted = 0

  for (let s = 0; s < stripeCount; s++) {
    if (algorithm === 'raid5') {
      readAndReconstructRaid5Stripe(s, onDisk, reconstructed, volume, diskStore)
    } else if (algorithm === 'raid6') {
      readAndReconstructRaid6Stripe(s, onDisk, reconstructed, volume, diskStore)
    } else {
      readAndReconstructRSStripe(s, onDisk, reconstructed, volume, diskStore)
    }
  }

  // Compute stats
  for (let i = 0; i < totalPixels; i++) {
    if (onDisk[i] === image.pixels[i]) matching++
    else if (onDisk[i] === 0 && image.pixels[i] !== 0) missing++
  }

  // Count corrupted pixels across all disks
  for (const disk of diskStore.disks) {
    corrupted += disk.corruptedPixels.size
  }

  return {
    onDisk,
    reconstructed,
    stats: { total: totalPixels, matching, missing, corrupted },
  }
}

function readAndReconstructRaid5Stripe(
  s: number,
  onDisk: Uint8Array,
  reconstructed: Uint8Array,
  volume: ReturnType<typeof useVolumeStore>,
  diskStore: ReturnType<typeof useDiskStore>,
) {
  const { dataDisks, blockSize, totalDisks } = volume
  const layout = raid5Layout(totalDisks, s)
  const pixelsPerStripe = dataDisks * blockSize
  const totalPixels = onDisk.length

  // Gather data blocks and parity from disks
  const allBlocks: (Uint8Array | null)[] = []
  let failedDataIdx = -1

  for (let d = 0; d < layout.dataDisks.length; d++) {
    const disk = diskStore.disks[layout.dataDisks[d]]
    if (disk.status === 'failed') {
      allBlocks.push(null)
      failedDataIdx = d
    } else {
      allBlocks.push(disk.pixels.slice(s * blockSize, (s + 1) * blockSize))
    }
  }

  // Write on-disk data (what's actually readable)
  for (let d = 0; d < layout.dataDisks.length; d++) {
    const block = allBlocks[d]
    for (let i = 0; i < blockSize; i++) {
      const outIdx = s * pixelsPerStripe + d * blockSize + i
      if (outIdx >= totalPixels) break
      onDisk[outIdx] = block ? block[i] : 0
    }
  }

  // Reconstruct: if one data disk failed, XOR all other blocks + parity
  if (failedDataIdx >= 0) {
    const parityDisk = diskStore.disks[layout.parityP]
    if (parityDisk.status !== 'failed') {
      const parity = parityDisk.pixels.slice(s * blockSize, (s + 1) * blockSize)
      const recovered = new Uint8Array(blockSize)
      // XOR parity with all surviving data blocks
      for (let i = 0; i < blockSize; i++) {
        recovered[i] = parity[i]
      }
      for (let d = 0; d < layout.dataDisks.length; d++) {
        if (d === failedDataIdx) continue
        const block = allBlocks[d]!
        for (let i = 0; i < blockSize; i++) {
          recovered[i] ^= block[i]
        }
      }

      // Write reconstructed data
      for (let i = 0; i < blockSize; i++) {
        const outIdx = s * pixelsPerStripe + failedDataIdx * blockSize + i
        if (outIdx >= totalPixels) break
        reconstructed[outIdx] = recovered[i]
      }

      // Copy surviving data to reconstructed
      for (let d = 0; d < layout.dataDisks.length; d++) {
        if (d === failedDataIdx) continue
        const block = allBlocks[d]!
        for (let i = 0; i < blockSize; i++) {
          const outIdx = s * pixelsPerStripe + d * blockSize + i
          if (outIdx >= totalPixels) break
          reconstructed[outIdx] = block[i]
        }
      }
    } else {
      // Both data disk AND parity disk failed — can't recover
      for (let d = 0; d < layout.dataDisks.length; d++) {
        const block = allBlocks[d]
        for (let i = 0; i < blockSize; i++) {
          const outIdx = s * pixelsPerStripe + d * blockSize + i
          if (outIdx >= totalPixels) break
          reconstructed[outIdx] = block ? block[i] : 0
        }
      }
    }
  } else {
    // No failures — reconstructed = on-disk
    for (let d = 0; d < layout.dataDisks.length; d++) {
      for (let i = 0; i < blockSize; i++) {
        const outIdx = s * pixelsPerStripe + d * blockSize + i
        if (outIdx >= totalPixels) break
        reconstructed[outIdx] = onDisk[outIdx]
      }
    }
  }
}

function readAndReconstructRaid6Stripe(
  s: number,
  onDisk: Uint8Array,
  reconstructed: Uint8Array,
  volume: ReturnType<typeof useVolumeStore>,
  diskStore: ReturnType<typeof useDiskStore>,
) {
  const { dataDisks, blockSize, totalDisks } = volume
  const layout = raid6Layout(totalDisks, s)
  const pixelsPerStripe = dataDisks * blockSize
  const totalPixels = onDisk.length

  // Gather all blocks (data + parity P + parity Q)
  const dataBlocks: (Uint8Array | null)[] = []
  const failedDataIndices: number[] = []

  for (let d = 0; d < layout.dataDisks.length; d++) {
    const disk = diskStore.disks[layout.dataDisks[d]]
    if (disk.status === 'failed') {
      dataBlocks.push(null)
      failedDataIndices.push(d)
    } else {
      dataBlocks.push(disk.pixels.slice(s * blockSize, (s + 1) * blockSize))
    }
  }

  const parityPDisk = diskStore.disks[layout.parityP]
  const parityQDisk = diskStore.disks[layout.parityQ!]
  const hasP = parityPDisk.status !== 'failed'
  const hasQ = parityQDisk.status !== 'failed'
  const parity = hasP ? parityPDisk.pixels.slice(s * blockSize, (s + 1) * blockSize) : null
  const qSyndrome = hasQ ? parityQDisk.pixels.slice(s * blockSize, (s + 1) * blockSize) : null

  // Write on-disk data
  for (let d = 0; d < layout.dataDisks.length; d++) {
    const block = dataBlocks[d]
    for (let i = 0; i < blockSize; i++) {
      const outIdx = s * pixelsPerStripe + d * blockSize + i
      if (outIdx >= totalPixels) break
      onDisk[outIdx] = block ? block[i] : 0
    }
  }

  // Reconstruct
  if (failedDataIndices.length === 0) {
    // No failures
    for (let d = 0; d < layout.dataDisks.length; d++) {
      for (let i = 0; i < blockSize; i++) {
        const outIdx = s * pixelsPerStripe + d * blockSize + i
        if (outIdx >= totalPixels) break
        reconstructed[outIdx] = onDisk[outIdx]
      }
    }
  } else if (failedDataIndices.length === 1 && hasP) {
    // Single failure, use P (XOR) parity
    const fi = failedDataIndices[0]
    const recovered = new Uint8Array(blockSize)
    for (let i = 0; i < blockSize; i++) recovered[i] = parity![i]
    for (let d = 0; d < layout.dataDisks.length; d++) {
      if (d === fi) continue
      for (let i = 0; i < blockSize; i++) recovered[i] ^= dataBlocks[d]![i]
    }
    writeReconstructed(s, layout.dataDisks.length, dataBlocks, reconstructed, volume, fi, recovered)
  } else if (failedDataIndices.length === 2 && hasP && hasQ) {
    // Two data disk failures — use P + Q syndromes
    const [x, y] = failedDataIndices
    const recovered = recoverTwoFromPQ(
      dataBlocks, parity!, qSyndrome!, x, y, blockSize,
    )
    writeReconstructed2(s, layout.dataDisks.length, dataBlocks, reconstructed, volume, x, recovered[0], y, recovered[1])
  } else if (failedDataIndices.length === 1 && !hasP && hasQ) {
    // Single data failure, P disk also failed, use Q to recover
    const fi = failedDataIndices[0]
    const recovered = recoverOneFromQ(dataBlocks, qSyndrome!, fi, blockSize)
    writeReconstructed(s, layout.dataDisks.length, dataBlocks, reconstructed, volume, fi, recovered)
  } else {
    // Too many failures — copy what we have
    for (let d = 0; d < layout.dataDisks.length; d++) {
      const block = dataBlocks[d]
      for (let i = 0; i < blockSize; i++) {
        const outIdx = s * pixelsPerStripe + d * blockSize + i
        if (outIdx >= totalPixels) break
        reconstructed[outIdx] = block ? block[i] : 0
      }
    }
  }
}

function recoverTwoFromPQ(
  dataBlocks: (Uint8Array | null)[],
  parity: Uint8Array,
  qSyndrome: Uint8Array,
  x: number,
  y: number,
  blockSize: number,
): [Uint8Array, Uint8Array] {
  const recoveredX = new Uint8Array(blockSize)
  const recoveredY = new Uint8Array(blockSize)

  // Compute partial P and Q syndromes from surviving data
  const partialP = new Uint8Array(blockSize)
  const partialQ = new Uint8Array(blockSize)
  for (let d = 0; d < dataBlocks.length; d++) {
    if (d === x || d === y) continue
    const block = dataBlocks[d]!
    const coeff = gfPow(2, d)
    for (let i = 0; i < blockSize; i++) {
      partialP[i] ^= block[i]
      partialQ[i] = gfAdd(partialQ[i], gfMul(coeff, block[i]))
    }
  }

  // Dp = P XOR partialP = Dx XOR Dy
  // Dq = Q XOR partialQ = g^x * Dx + g^y * Dy
  const gx = gfPow(2, x)
  const gy = gfPow(2, y)

  for (let i = 0; i < blockSize; i++) {
    const dp = parity[i] ^ partialP[i]
    const dq = gfAdd(qSyndrome[i], partialQ[i])

    // Dx = (dq + gy * dp) / (gx + gy)
    const denom = gfAdd(gx, gy)
    recoveredX[i] = gfDiv(gfAdd(dq, gfMul(gy, dp)), denom)
    recoveredY[i] = dp ^ recoveredX[i]
  }

  return [recoveredX, recoveredY]
}

function recoverOneFromQ(
  dataBlocks: (Uint8Array | null)[],
  qSyndrome: Uint8Array,
  failedIdx: number,
  blockSize: number,
): Uint8Array {
  const recovered = new Uint8Array(blockSize)
  const partialQ = new Uint8Array(blockSize)
  for (let d = 0; d < dataBlocks.length; d++) {
    if (d === failedIdx) continue
    const block = dataBlocks[d]!
    const coeff = gfPow(2, d)
    for (let i = 0; i < blockSize; i++) {
      partialQ[i] = gfAdd(partialQ[i], gfMul(coeff, block[i]))
    }
  }
  const gf = gfPow(2, failedIdx)
  for (let i = 0; i < blockSize; i++) {
    recovered[i] = gfDiv(gfAdd(qSyndrome[i], partialQ[i]), gf)
  }
  return recovered
}

function readAndReconstructRSStripe(
  s: number,
  onDisk: Uint8Array,
  reconstructed: Uint8Array,
  volume: ReturnType<typeof useVolumeStore>,
  diskStore: ReturnType<typeof useDiskStore>,
) {
  const { dataDisks, parityDisks, blockSize } = volume
  const pixelsPerStripe = dataDisks * blockSize
  const totalPixels = onDisk.length
  const totalShards = dataDisks + parityDisks

  // Gather all shards (data + parity)
  const shards: (Uint8Array | null)[] = []
  for (let d = 0; d < totalShards; d++) {
    const disk = diskStore.disks[d]
    if (disk.status === 'failed') {
      shards.push(null)
    } else {
      shards.push(disk.pixels.slice(s * blockSize, (s + 1) * blockSize))
    }
  }

  // Write on-disk data (data shards only)
  for (let d = 0; d < dataDisks; d++) {
    const block = shards[d]
    for (let i = 0; i < blockSize; i++) {
      const outIdx = s * pixelsPerStripe + d * blockSize + i
      if (outIdx >= totalPixels) break
      onDisk[outIdx] = block ? block[i] : 0
    }
  }

  // Count failures
  const failedCount = shards.filter(s => s === null).length

  if (failedCount === 0) {
    // No failures
    for (let d = 0; d < dataDisks; d++) {
      for (let i = 0; i < blockSize; i++) {
        const outIdx = s * pixelsPerStripe + d * blockSize + i
        if (outIdx >= totalPixels) break
        reconstructed[outIdx] = onDisk[outIdx]
      }
    }
  } else if (failedCount <= parityDisks) {
    // Can recover using Reed-Solomon
    try {
      const recoveredData = rsReconstruct(shards, dataDisks, parityDisks)
      for (let d = 0; d < dataDisks; d++) {
        for (let i = 0; i < blockSize; i++) {
          const outIdx = s * pixelsPerStripe + d * blockSize + i
          if (outIdx >= totalPixels) break
          reconstructed[outIdx] = recoveredData[d][i]
        }
      }
    } catch {
      // Reconstruction failed
      for (let d = 0; d < dataDisks; d++) {
        const block = shards[d]
        for (let i = 0; i < blockSize; i++) {
          const outIdx = s * pixelsPerStripe + d * blockSize + i
          if (outIdx >= totalPixels) break
          reconstructed[outIdx] = block ? block[i] : 0
        }
      }
    }
  } else {
    // Too many failures
    for (let d = 0; d < dataDisks; d++) {
      const block = shards[d]
      for (let i = 0; i < blockSize; i++) {
        const outIdx = s * pixelsPerStripe + d * blockSize + i
        if (outIdx >= totalPixels) break
        reconstructed[outIdx] = block ? block[i] : 0
      }
    }
  }
}

/** Helper: write reconstructed data for a single-failure scenario. */
function writeReconstructed(
  s: number,
  dataCount: number,
  dataBlocks: (Uint8Array | null)[],
  reconstructed: Uint8Array,
  volume: ReturnType<typeof useVolumeStore>,
  failedIdx: number,
  recovered: Uint8Array,
) {
  const { blockSize, dataDisks } = volume
  const pixelsPerStripe = dataDisks * blockSize
  const totalPixels = reconstructed.length

  for (let d = 0; d < dataCount; d++) {
    const src = d === failedIdx ? recovered : dataBlocks[d]!
    for (let i = 0; i < blockSize; i++) {
      const outIdx = s * pixelsPerStripe + d * blockSize + i
      if (outIdx >= totalPixels) break
      reconstructed[outIdx] = src[i]
    }
  }
}

/** Helper: write reconstructed data for a double-failure scenario. */
function writeReconstructed2(
  s: number,
  dataCount: number,
  dataBlocks: (Uint8Array | null)[],
  reconstructed: Uint8Array,
  volume: ReturnType<typeof useVolumeStore>,
  failedIdx1: number,
  recovered1: Uint8Array,
  failedIdx2: number,
  recovered2: Uint8Array,
) {
  const { blockSize, dataDisks } = volume
  const pixelsPerStripe = dataDisks * blockSize
  const totalPixels = reconstructed.length

  for (let d = 0; d < dataCount; d++) {
    let src: Uint8Array
    if (d === failedIdx1) src = recovered1
    else if (d === failedIdx2) src = recovered2
    else src = dataBlocks[d]!
    for (let i = 0; i < blockSize; i++) {
      const outIdx = s * pixelsPerStripe + d * blockSize + i
      if (outIdx >= totalPixels) break
      reconstructed[outIdx] = src[i]
    }
  }
}

/**
 * Rebuild a failed disk: reconstruct its data from parity and surviving disks,
 * then write the data back to the disk.
 */
export function rebuildDisk(diskId: number): boolean {
  const volume = useVolumeStore()
  const diskStore = useDiskStore()

  const { dataDisks, parityDisks, blockSize, totalDisks, algorithm } = volume
  const disk = diskStore.disks[diskId]
  if (!disk) return false

  const stripeCount = Math.ceil(disk.pixels.length / blockSize)

  // Allocate new pixel data
  const newPixels = new Uint8Array(disk.pixels.length)

  for (let s = 0; s < stripeCount; s++) {
    if (algorithm === 'raid5') {
      const layout = raid5Layout(totalDisks, s)
      const isParityDisk = layout.parityP === diskId
      const dataIdx = layout.dataDisks.indexOf(diskId)

      if (isParityDisk) {
        // Rebuild parity: XOR all data blocks
        const dataBlocks = layout.dataDisks.map(di =>
          diskStore.disks[di].pixels.slice(s * blockSize, (s + 1) * blockSize),
        )
        const parity = computeXorParity(dataBlocks)
        newPixels.set(parity, s * blockSize)
      } else if (dataIdx >= 0) {
        // Rebuild data: XOR parity with all other data blocks
        const parityDisk = diskStore.disks[layout.parityP]
        if (parityDisk.status === 'failed') return false

        const parity = parityDisk.pixels.slice(s * blockSize, (s + 1) * blockSize)
        const recovered = new Uint8Array(blockSize)
        for (let i = 0; i < blockSize; i++) recovered[i] = parity[i]

        for (let d = 0; d < layout.dataDisks.length; d++) {
          if (layout.dataDisks[d] === diskId) continue
          const otherDisk = diskStore.disks[layout.dataDisks[d]]
          if (otherDisk.status === 'failed') return false
          const block = otherDisk.pixels.slice(s * blockSize, (s + 1) * blockSize)
          for (let i = 0; i < blockSize; i++) recovered[i] ^= block[i]
        }

        newPixels.set(recovered, s * blockSize)
      }
    } else if (algorithm === 'raid6') {
      const layout = raid6Layout(totalDisks, s)
      const isParityP = layout.parityP === diskId
      const isParityQ = layout.parityQ === diskId
      const dataIdx = layout.dataDisks.indexOf(diskId)

      if (isParityP) {
        // Rebuild P parity
        const dataBlocks = layout.dataDisks.map(di =>
          diskStore.disks[di].pixels.slice(s * blockSize, (s + 1) * blockSize),
        )
        newPixels.set(computeXorParity(dataBlocks), s * blockSize)
      } else if (isParityQ) {
        // Rebuild Q parity
        const dataBlocks = layout.dataDisks.map(di =>
          diskStore.disks[di].pixels.slice(s * blockSize, (s + 1) * blockSize),
        )
        newPixels.set(computeQSyndrome(dataBlocks), s * blockSize)
      } else if (dataIdx >= 0) {
        // Rebuild a data disk — use P parity (simpler, single failure)
        const parityDisk = diskStore.disks[layout.parityP]
        if (parityDisk.status !== 'failed') {
          const parity = parityDisk.pixels.slice(s * blockSize, (s + 1) * blockSize)
          const recovered = new Uint8Array(blockSize)
          for (let i = 0; i < blockSize; i++) recovered[i] = parity[i]
          for (let d = 0; d < layout.dataDisks.length; d++) {
            if (layout.dataDisks[d] === diskId) continue
            const block = diskStore.disks[layout.dataDisks[d]].pixels.slice(s * blockSize, (s + 1) * blockSize)
            for (let i = 0; i < blockSize; i++) recovered[i] ^= block[i]
          }
          newPixels.set(recovered, s * blockSize)
        }
      }
    } else {
      // Reed-Solomon rebuild
      const totalShards = dataDisks + parityDisks
      const shards: (Uint8Array | null)[] = []
      for (let d = 0; d < totalShards; d++) {
        if (d === diskId || diskStore.disks[d].status === 'failed') {
          shards.push(null)
        } else {
          shards.push(diskStore.disks[d].pixels.slice(s * blockSize, (s + 1) * blockSize))
        }
      }

      const failedCount = shards.filter(x => x === null).length
      if (failedCount > parityDisks) return false

      try {
        const recoveredData = rsReconstruct(shards, dataDisks, parityDisks)
        if (diskId < dataDisks) {
          // Rebuild a data shard
          newPixels.set(recoveredData[diskId], s * blockSize)
        } else {
          // Rebuild a parity shard — re-encode from recovered data
          const parityShards = rsEncode(recoveredData, parityDisks)
          const parityIdx = diskId - dataDisks
          newPixels.set(parityShards[parityIdx], s * blockSize)
        }
      } catch {
        return false
      }
    }
  }

  // Write rebuilt data
  disk.pixels = newPixels
  return true
}
