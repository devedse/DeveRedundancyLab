<script setup lang="ts">
import { computed } from 'vue'
import type { DiskState } from '@/stores/disks'
import type { DiskStatus } from '@/engine/types'

const props = defineProps<{
  disk: DiskState
  role?: string
}>()

const statusIcon = computed(() => {
  const icons: Record<DiskStatus, string> = {
    healthy: '🟢',
    failed: '🔴',
    degraded: '🟡',
    rebuilding: '🔵',
    corrupted: '🟣',
    empty: '⚪',
  }
  return icons[props.disk.status]
})
</script>

<template>
  <div class="flex items-center gap-1.5 px-2 py-1.5 border-b border-border/50">
    <span class="text-sm" :title="disk.status">{{ statusIcon }}</span>
    <span class="text-xs font-semibold text-text-primary truncate">Disk {{ disk.id }}</span>
    <span
      v-if="role"
      class="text-[9px] font-mono px-1 rounded bg-surface-3 text-text-muted"
    >{{ role }}</span>
    <span class="text-[10px] font-mono text-text-muted ml-auto">
      {{ disk.pixels.length }}B
    </span>
  </div>
</template>
