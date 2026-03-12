import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { DiskStatus } from '@/engine/types'

export interface DiskState {
  id: number
  status: DiskStatus
  pixels: Uint8Array
  checksums: Uint8Array
  corruptedPixels: Set<number>
}

function createEmptyDisk(id: number): DiskState {
  return {
    id,
    status: 'empty',
    pixels: new Uint8Array(0),
    checksums: new Uint8Array(0),
    corruptedPixels: new Set(),
  }
}

export const useDiskStore = defineStore('disks', () => {
  const disks = ref<DiskState[]>([])

  const healthyCount = computed(
    () => disks.value.filter(d => d.status === 'healthy').length,
  )

  const failedCount = computed(
    () => disks.value.filter(d => d.status === 'failed').length,
  )

  /** Initialize disk array with N empty disks. */
  function initDisks(count: number) {
    disks.value = Array.from({ length: count }, (_, i) => createEmptyDisk(i))
  }

  /** Set pixel data for a specific disk. */
  function setDiskPixels(diskId: number, pixels: Uint8Array) {
    const disk = disks.value[diskId]
    if (!disk) return
    disk.pixels = pixels
    disk.status = 'healthy'
  }

  /** Mark a disk as failed. */
  function removeDisk(diskId: number) {
    const disk = disks.value[diskId]
    if (!disk) return
    disk.status = 'failed'
  }

  /** Re-add a failed disk with its data intact. */
  function readdDisk(diskId: number) {
    const disk = disks.value[diskId]
    if (!disk) return
    disk.status = disk.corruptedPixels.size > 0 ? 'corrupted' : 'healthy'
  }

  /** Wipe a disk (zeros but stays in array). */
  function wipeDisk(diskId: number) {
    const disk = disks.value[diskId]
    if (!disk) return
    disk.pixels = new Uint8Array(disk.pixels.length)
    disk.status = 'empty'
    disk.corruptedPixels.clear()
  }

  /** Flip random bits on a disk pixel (cosmic ray). */
  function flipBits(diskId: number, pixelIndex: number, mask: number) {
    const disk = disks.value[diskId]
    if (!disk || pixelIndex >= disk.pixels.length) return
    const updated = disk.pixels.slice()
    updated[pixelIndex] ^= mask
    disk.pixels = updated
    disk.corruptedPixels = new Set(disk.corruptedPixels).add(pixelIndex)
    if (disk.status === 'healthy') {
      disk.status = 'corrupted'
    }
  }

  /** Mark disk as rebuilding. */
  function startRebuild(diskId: number) {
    const disk = disks.value[diskId]
    if (!disk) return
    disk.status = 'rebuilding'
  }

  /** Mark rebuild complete. */
  function finishRebuild(diskId: number) {
    const disk = disks.value[diskId]
    if (!disk) return
    disk.status = 'healthy'
    disk.corruptedPixels.clear()
  }

  function $reset() {
    disks.value = []
  }

  return {
    disks,
    healthyCount,
    failedCount,
    initDisks,
    setDiskPixels,
    removeDisk,
    readdDisk,
    wipeDisk,
    flipBits,
    startRebuild,
    finishRebuild,
    $reset,
  }
})
