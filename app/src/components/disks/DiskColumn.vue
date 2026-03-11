<script setup lang="ts">
import type { DiskState } from '@/stores/disks'
import { useDiskStore } from '@/stores/disks'
import { useVolumeStore } from '@/stores/volume'
import DiskHeader from './DiskHeader.vue'
import PixelGrid from './PixelGrid.vue'
import DiskActionBar from './DiskActionBar.vue'

defineProps<{ disk: DiskState }>()

const diskStore = useDiskStore()
const volume = useVolumeStore()

function handleAction(action: string, diskId: number) {
  switch (action) {
    case 'remove':
      diskStore.removeDisk(diskId)
      break
    case 'wipe':
      diskStore.wipeDisk(diskId)
      break
    case 'cosmic':
      if (diskStore.disks[diskId].pixels.length > 0) {
        const pixelIdx = Math.floor(Math.random() * diskStore.disks[diskId].pixels.length)
        const mask = 1 << Math.floor(Math.random() * 8)
        diskStore.flipBits(diskId, pixelIdx, mask)
      }
      break
    case 'readd':
      diskStore.readdDisk(diskId)
      break
    case 'rebuild':
      // Will be handled by the rebuild composable
      diskStore.startRebuild(diskId)
      break
  }
}
</script>

<template>
  <div
    class="disk-column flex flex-col rounded-lg border bg-surface-2 min-w-[100px]"
    :class="{
      'border-disk-healthy': disk.status === 'healthy',
      'border-disk-failed': disk.status === 'failed',
      'border-disk-degraded': disk.status === 'degraded',
      'border-disk-rebuilding': disk.status === 'rebuilding',
      'border-disk-corrupted': disk.status === 'corrupted',
      'border-border': disk.status === 'empty',
    }"
  >
    <DiskHeader :disk="disk" />

    <div class="flex-1 p-2">
      <PixelGrid
        :pixels="disk.pixels"
        :block-size="volume.blockSize"
        :status="disk.status"
      />
    </div>

    <DiskActionBar
      :disk-id="disk.id"
      :status="disk.status"
      @action="handleAction"
    />
  </div>
</template>

<style scoped>
.disk-column {
  transition: border-color 0.2s ease;
}
</style>
