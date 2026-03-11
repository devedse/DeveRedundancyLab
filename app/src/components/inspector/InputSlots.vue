<script setup lang="ts">
import type { CalcInput } from '@/stores/calcEngine'
import { byteToCssColor } from '@/utils/palette'
import { toHex } from '@/utils/format'

defineProps<{ inputs: CalcInput[] }>()
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <span class="text-[10px] text-text-muted uppercase font-semibold tracking-wider">
      Inputs
    </span>
    <div class="flex flex-col gap-1 overflow-y-auto flex-1">
      <div
        v-for="(input, idx) in inputs"
        :key="idx"
        class="input-slot flex items-center gap-2 rounded px-2 py-1"
        :class="{
          'bg-surface-2 border border-border': input.status === 'filled',
          'bg-red-950/30 border border-dashed border-disk-failed/50': input.status === 'missing',
          'bg-purple-950/30 border border-disk-corrupted/50': input.status === 'corrupted',
          'bg-surface-3/50 border border-dashed border-border': input.status === 'pending',
        }"
      >
        <!-- Color swatch or placeholder -->
        <div
          v-if="input.value !== null"
          class="w-5 h-5 rounded-sm shrink-0 border border-white/10"
          :style="{ backgroundColor: byteToCssColor(input.value) }"
        />
        <div
          v-else
          class="w-5 h-5 rounded-sm shrink-0 flex items-center justify-center
                 bg-surface-0 border border-dashed border-disk-failed/50 text-disk-failed text-xs font-bold"
        >?</div>

        <!-- Value + label -->
        <div class="flex flex-col min-w-0">
          <span class="text-xs font-mono text-text-primary truncate">
            {{ input.value !== null ? toHex(input.value) : '??' }}
          </span>
          <span class="text-[10px] text-text-muted truncate">{{ input.label }}</span>
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-if="inputs.length === 0"
        class="flex-1 flex items-center justify-center text-text-muted text-xs"
      >
        No inputs
      </div>
    </div>
  </div>
</template>

<style scoped>
.input-slot {
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
</style>
