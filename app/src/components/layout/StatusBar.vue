<script setup lang="ts">
import { computed } from 'vue'
import { useVolumeStore } from '@/stores/volume'
import { useDiskStore } from '@/stores/disks'

const volume = useVolumeStore()
const diskStore = useDiskStore()

const statusText = computed(() => {
  if (!volume.populated) return 'Ready — drag an image onto the volume to begin.'

  const failed = diskStore.failedCount
  if (failed === 0) return 'Array healthy — all disks operational.'

  const tolerable = volume.parityDisks - failed
  if (tolerable >= 0) {
    return `Array degraded — ${failed} disk(s) failed. Can tolerate ${tolerable} more.`
  }
  return 'ARRAY FAILED — Data unrecoverable.'
})

const statusColor = computed(() => {
  if (!volume.populated) return 'text-text-muted'
  const failed = diskStore.failedCount
  if (failed === 0) return 'text-disk-healthy'
  if (failed <= volume.parityDisks) return 'text-disk-degraded'
  return 'text-disk-failed'
})
</script>

<template>
  <footer class="flex items-center px-4 py-1.5 bg-surface-1 border-t border-border text-xs">
    <span :class="statusColor">{{ statusText }}</span>
    <span class="ml-auto text-text-muted font-mono">
      {{ volume.totalDisks }} disks · {{ volume.algorithm.toUpperCase() }}
    </span>
  </footer>
</template>
