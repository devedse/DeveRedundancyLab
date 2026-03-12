/**
 * Image distribution logic: splits image pixels into stripes
 * and distributes them across disks according to the chosen RAID algorithm.
 */
import type { ImageAsset } from '@/stores/images'
import type { useVolumeStore } from '@/stores/volume'
import type { useDiskStore } from '@/stores/disks'
import { computeXorParity, computeQSyndrome, raid5Layout, raid6Layout } from '@/engine/raid'
import { encode as rsEncode } from '@/engine/reedsolomon'

type VolumeStore = ReturnType<typeof useVolumeStore>
type DiskStore = ReturnType<typeof useDiskStore>

/** A single write operation for one block on one disk. */
export interface WriteOp {
  diskId: number
  offset: number
  data: Uint8Array
  role: 'data' | 'parity-p' | 'parity-q'
}

/** Pre-computed plan for distributing an image across disks. */
export interface DistributionPlan {
  stripeWrites: WriteOp[][] // grouped by stripe index
  stripeCount: number
  blockSize: number
  totalDisks: number
  totalBytesPerDisk: number
}

/**
 * Compute a distribution plan without writing anything.
 */
export function computeDistributionPlan(
  image: ImageAsset,
  volume: VolumeStore,
): DistributionPlan {
  const { dataDisks, parityDisks, blockSize, totalDisks, algorithm } = volume
  const totalPixels = image.pixels.length
  const pixelsPerStripe = dataDisks * blockSize
  const stripeCount = Math.ceil(totalPixels / pixelsPerStripe)
  const totalBytesPerDisk = stripeCount * blockSize

  const stripeWrites: WriteOp[][] = []

  for (let s = 0; s < stripeCount; s++) {
    const writes: WriteOp[] = []
    const dataBlocks: Uint8Array[] = []
    for (let d = 0; d < dataDisks; d++) {
      const start = s * pixelsPerStripe + d * blockSize
      const block = new Uint8Array(blockSize)
      for (let i = 0; i < blockSize; i++) {
        const srcIdx = start + i
        block[i] = srcIdx < totalPixels ? image.pixels[srcIdx] : 0
      }
      dataBlocks.push(block)
    }

    if (algorithm === 'raid5') {
      const layout = raid5Layout(totalDisks, s)
      for (let d = 0; d < layout.dataDisks.length; d++) {
        writes.push({ diskId: layout.dataDisks[d], offset: s * blockSize, data: dataBlocks[d], role: 'data' })
      }
      writes.push({ diskId: layout.parityP, offset: s * blockSize, data: computeXorParity(dataBlocks), role: 'parity-p' })
    } else if (algorithm === 'raid6') {
      const layout = raid6Layout(totalDisks, s)
      for (let d = 0; d < layout.dataDisks.length; d++) {
        writes.push({ diskId: layout.dataDisks[d], offset: s * blockSize, data: dataBlocks[d], role: 'data' })
      }
      writes.push({ diskId: layout.parityP, offset: s * blockSize, data: computeXorParity(dataBlocks), role: 'parity-p' })
      writes.push({ diskId: layout.parityQ!, offset: s * blockSize, data: computeQSyndrome(dataBlocks), role: 'parity-q' })
    } else {
      for (let d = 0; d < dataDisks; d++) {
        writes.push({ diskId: d, offset: s * blockSize, data: dataBlocks[d], role: 'data' })
      }
      const parityShards = rsEncode(dataBlocks, parityDisks)
      for (let p = 0; p < parityDisks; p++) {
        writes.push({ diskId: dataDisks + p, offset: s * blockSize, data: parityShards[p], role: 'parity-p' })
      }
    }

    stripeWrites.push(writes)
  }

  return { stripeWrites, stripeCount, blockSize, totalDisks, totalBytesPerDisk }
}

/**
 * Distribute an image instantly (no animation).
 */
export function distributeImage(
  image: ImageAsset,
  volume: VolumeStore,
  diskStore: DiskStore,
): void {
  const plan = computeDistributionPlan(image, volume)

  diskStore.initDisks(plan.totalDisks)
  for (let d = 0; d < plan.totalDisks; d++) {
    diskStore.disks[d].pixels = new Uint8Array(plan.totalBytesPerDisk)
  }

  for (const stripeOps of plan.stripeWrites) {
    for (const op of stripeOps) {
      diskStore.disks[op.diskId].pixels.set(op.data, op.offset)
    }
  }

  for (const disk of diskStore.disks) {
    disk.status = 'healthy'
  }

  volume.sourceImageId = image.id
  volume.populated = true
}
