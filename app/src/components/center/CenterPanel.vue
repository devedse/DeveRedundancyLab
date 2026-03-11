<script setup lang="ts">
import VolumeConfigBar from '@/components/volume/VolumeConfigBar.vue'
import VolumePreview from '@/components/volume/VolumePreview.vue'
import DiskArrayView from '@/components/disks/DiskArrayView.vue'
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <VolumeConfigBar />

    <div class="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
      <DiskArrayView />
      <VolumePreview />
    </div>
  </div>
</template>
