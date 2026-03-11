<script setup lang="ts">
import type { CalcOutput } from '@/stores/calcEngine'
import { byteToCssColor } from '@/utils/palette'
import { toHex } from '@/utils/format'

defineProps<{ outputs: CalcOutput[] }>()
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <span class="text-[10px] text-text-muted uppercase font-semibold tracking-wider">
      Output
    </span>
    <div class="flex flex-col gap-1.5 overflow-y-auto flex-1">
      <div
        v-for="(output, idx) in outputs"
        :key="idx"
        class="output-slot flex items-center gap-2 rounded px-2 py-1.5"
        :class="{
          'bg-surface-2 border border-accent/30': output.status === 'computed',
          'bg-red-950/30 border border-disk-failed/50': output.status === 'failed',
        }"
      >
        <!-- Color swatch or failure marker -->
        <div
          v-if="output.value !== null"
          class="w-6 h-6 rounded-sm shrink-0 border border-white/10 shadow-sm"
          :style="{
            backgroundColor: byteToCssColor(output.value),
            boxShadow: output.status === 'computed' ? '0 0 6px rgba(108, 140, 255, 0.4)' : 'none',
          }"
        />
        <div
          v-else
          class="w-6 h-6 rounded-sm shrink-0 flex items-center justify-center
                 bg-surface-0 border border-disk-failed text-disk-failed text-base font-bold"
        >✕</div>

        <!-- Value + label -->
        <div class="flex flex-col min-w-0">
          <span
            class="text-xs font-mono truncate"
            :class="output.status === 'computed' ? 'text-text-primary' : 'text-disk-failed'"
          >
            {{ output.value !== null ? toHex(output.value) : 'FAIL' }}
          </span>
          <span class="text-[10px] text-text-muted truncate">{{ output.label }}</span>
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-if="outputs.length === 0"
        class="flex-1 flex items-center justify-center text-text-muted text-xs"
      >
        No output
      </div>
    </div>
  </div>
</template>

<style scoped>
.output-slot {
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
</style>
