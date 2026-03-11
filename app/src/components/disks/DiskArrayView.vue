<script setup lang="ts">
import { useVolumeStore } from '@/stores/volume'
import { useDiskStore } from '@/stores/disks'
import { useImageStore } from '@/stores/images'
import DiskColumn from './DiskColumn.vue'
import { distributeImage } from '@/composables/useDistribution'

const volume = useVolumeStore()
const diskStore = useDiskStore()
const imageStore = useImageStore()

function onDragOver(event: DragEvent) {
  if (event.dataTransfer?.types.includes('application/x-image-id')) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }
}

function onDrop(event: DragEvent) {
  event.preventDefault()
  const imageId = event.dataTransfer?.getData('application/x-image-id')
  if (!imageId) return

  const image = imageStore.images.find(img => img.id === imageId)
  if (!image) return

  distributeImage(image, volume, diskStore)
}
</script>

<template>
  <div
    class="rounded-lg border border-border bg-surface-1 p-3"
    :class="{ 'border-dashed border-accent/40': !volume.populated }"
    @dragover="onDragOver"
    @drop="onDrop"
  >
    <h3 class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
      Disk Array
    </h3>

    <!-- Empty state -->
    <div
      v-if="!volume.populated"
      class="flex items-center justify-center h-48 text-text-muted text-sm"
    >
      Drag an image here to distribute across disks
    </div>

    <!-- Disk columns -->
    <div
      v-else
      class="flex gap-2 overflow-x-auto pb-2"
    >
      <DiskColumn
        v-for="disk in diskStore.disks"
        :key="disk.id"
        :disk="disk"
      />
    </div>
  </div>
</template>
