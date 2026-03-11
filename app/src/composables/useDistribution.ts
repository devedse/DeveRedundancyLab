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

/**
 * Distribute an image's pixel data across the disk array
 * and compute parity for each stripe.
 */
export function distributeImage(
  image: ImageAsset,
  volume: VolumeStore,
  diskStore: DiskStore,
): void {
  const { dataDisks, parityDisks, blockSize, totalDisks, algorithm } = volume
  const totalPixels = image.pixels.length

  // Re-initialize disks
  diskStore.initDisks(totalDisks)

  // Calculate the number of stripes needed
  const pixelsPerStripe = dataDisks * blockSize
  const stripeCount = Math.ceil(totalPixels / pixelsPerStripe)
  const totalBytesPerDisk = stripeCount * blockSize

  // Initialize pixel arrays for each disk
  for (let d = 0; d < totalDisks; d++) {
    diskStore.disks[d].pixels = new Uint8Array(totalBytesPerDisk)
  }

  // Distribute stripe by stripe
  for (let s = 0; s < stripeCount; s++) {
    // Extract data blocks for this stripe (one per data disk)
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

      // Place data on data disks
      for (let d = 0; d < layout.dataDisks.length; d++) {
        const diskIdx = layout.dataDisks[d]
        const offset = s * blockSize
        diskStore.disks[diskIdx].pixels.set(dataBlocks[d], offset)
      }

      // Compute and place P parity
      const parity = computeXorParity(dataBlocks)
      diskStore.disks[layout.parityP].pixels.set(parity, s * blockSize)
    } else if (algorithm === 'raid6') {
      const layout = raid6Layout(totalDisks, s)

      for (let d = 0; d < layout.dataDisks.length; d++) {
        const diskIdx = layout.dataDisks[d]
        diskStore.disks[diskIdx].pixels.set(dataBlocks[d], s * blockSize)
      }

      const p = computeXorParity(dataBlocks)
      const q = computeQSyndrome(dataBlocks)
      diskStore.disks[layout.parityP].pixels.set(p, s * blockSize)
      diskStore.disks[layout.parityQ!].pixels.set(q, s * blockSize)
    } else {
      // Reed-Solomon: data disks get data, parity disks get RS parity shards
      // Simple layout: first N disks are data, last K are parity
      for (let d = 0; d < dataDisks; d++) {
        diskStore.disks[d].pixels.set(dataBlocks[d], s * blockSize)
      }

      const parityShards = rsEncode(dataBlocks, parityDisks)
      for (let p = 0; p < parityDisks; p++) {
        diskStore.disks[dataDisks + p].pixels.set(parityShards[p], s * blockSize)
      }
    }
  }

  // Mark all disks as healthy
  for (const disk of diskStore.disks) {
    disk.status = 'healthy'
  }

  volume.populated = true
}
