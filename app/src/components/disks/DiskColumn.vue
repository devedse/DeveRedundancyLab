<script setup lang="ts">
import type { DiskState } from '@/stores/disks'
import { useDiskStore } from '@/stores/disks'
import { useVolumeStore } from '@/stores/volume'
import { rebuildDisk } from '@/composables/useRecovery'
import { inspectPixel } from '@/composables/useHoverInspect'
import { animateRebuild, getRebuildProgress, distributionState } from '@/composables/useAnimation'
import { raid5Layout, raid6Layout } from '@/engine/raid'
import { computed } from 'vue'
import DiskHeader from './DiskHeader.vue'
import PixelGrid from './PixelGrid.vue'
import DiskActionBar from './DiskActionBar.vue'

const props = defineProps<{ disk: DiskState }>()

const diskStore = useDiskStore()
const volume = useVolumeStore()

const rebuildProgress = computed(() => getRebuildProgress(props.disk.id))

const stripeCount = computed(() => {
  if (props.disk.pixels.length === 0 || volume.blockSize === 0) return 0
  return Math.ceil(props.disk.pixels.length / volume.blockSize)
})

const parityPRows = computed(() => {
  const rows = new Set<number>()
  const count = stripeCount.value
  if (count === 0) return rows
  const { algorithm, totalDisks, dataDisks } = volume
  if (algorithm === 'raid5') {
    for (let s = 0; s < count; s++) {
      if (raid5Layout(totalDisks, s).parityP === props.disk.id) rows.add(s)
    }
  } else if (algorithm === 'raid6') {
    for (let s = 0; s < count; s++) {
      if (raid6Layout(totalDisks, s).parityP === props.disk.id) rows.add(s)
    }
  } else {
    // Reed-Solomon: entire disk is parity if id >= dataDisks
    if (props.disk.id >= dataDisks) {
      for (let s = 0; s < count; s++) rows.add(s)
    }
  }
  return rows
})

const parityQRows = computed(() => {
  const rows = new Set<number>()
  if (volume.algorithm !== 'raid6') return rows
  const count = stripeCount.value
  for (let s = 0; s < count; s++) {
    if (raid6Layout(volume.totalDisks, s).parityQ === props.disk.id) rows.add(s)
  }
  return rows
})

const diskRole = computed(() => {
  const { algorithm, dataDisks, totalDisks } = volume
  const id = props.disk.id
  if (algorithm === 'raid5') {
    return id === totalDisks - 1 ? 'Parity' : 'Data'
  }
  if (algorithm === 'raid6') {
    if (id === totalDisks - 2) return 'P'
    if (id === totalDisks - 1) return 'Q'
    return 'Data'
  }
  // reed-solomon
  return id < dataDisks ? 'Data' : 'Parity'
})

const writeStripe = computed(() =>
  distributionState.active ? distributionState.currentStripe : -1)
const writePhase = computed(() =>
  distributionState.active ? distributionState.phase : null)

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
      diskStore.startRebuild(diskId)
      rebuildDisk(diskId)
      animateRebuild(diskId)
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
    <DiskHeader :disk="disk" :role="diskRole" />

    <div class="flex-1 p-2">
      <PixelGrid
        :pixels="disk.pixels"
        :block-size="volume.blockSize"
        :status="disk.status"
        :corrupted-pixels="disk.corruptedPixels"
        :rebuild-progress="rebuildProgress"
        :parity-p-rows="parityPRows"
        :parity-q-rows="parityQRows"
        :write-stripe="writeStripe"
        :write-phase="writePhase"
        @pixel-hover="(idx: number) => inspectPixel(disk.id, idx)"
        @pixel-click="(idx: number) => inspectPixel(disk.id, idx)"
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
