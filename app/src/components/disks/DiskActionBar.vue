<script setup lang="ts">
import type { DiskStatus } from '@/engine/types'

const props = defineProps<{
  diskId: number
  status: DiskStatus
}>()

const emit = defineEmits<{
  action: [action: string, diskId: number]
}>()

function act(action: string) {
  emit('action', action, props.diskId)
}
</script>

<template>
  <div class="flex items-center justify-center gap-1 px-1 py-1.5 border-t border-border/50">
    <button
      v-if="status === 'healthy' || status === 'degraded' || status === 'corrupted'"
      class="action-btn"
      title="Remove Disk"
      @click="act('remove')"
    >💀</button>

    <button
      v-if="status === 'healthy' || status === 'corrupted'"
      class="action-btn"
      title="Wipe Disk"
      @click="act('wipe')"
    >🧹</button>

    <button
      v-if="status === 'healthy'"
      class="action-btn"
      title="Cosmic Ray"
      @click="act('cosmic')"
    >☢️</button>

    <button
      v-if="status === 'failed'"
      class="action-btn"
      title="Re-add Disk"
      @click="act('readd')"
    >➕</button>

    <button
      v-if="status === 'empty'"
      class="action-btn"
      title="Rebuild Disk"
      @click="act('rebuild')"
    >🔄</button>
  </div>
</template>

<style scoped>
@reference "../../style.css";
.action-btn {
  @apply rounded px-1.5 py-0.5 text-sm bg-surface-3 hover:bg-surface-0
         transition-colors cursor-pointer border border-transparent
         hover:border-border-light;
}
</style>
