<script setup lang="ts">
import ImageLibraryPanel from '@/components/library/ImageLibraryPanel.vue'
import CenterPanel from '@/components/center/CenterPanel.vue'
import CalcEnginePanel from '@/components/inspector/CalcEnginePanel.vue'
</script>

<template>
  <div class="flex flex-1 min-h-0">
    <!-- Left sidebar: Image Library -->
    <aside class="w-56 shrink-0 border-r border-border bg-surface-1 overflow-y-auto">
      <ImageLibraryPanel />
    </aside>

    <!-- Main content area -->
    <div class="flex flex-col flex-1 min-w-0">
      <!-- Center: config bar + disk array + volume preview -->
      <CenterPanel class="flex-1 min-h-0" />

      <!-- Bottom: Calculation Engine -->
      <CalcEnginePanel />
    </div>
  </div>
</template>
