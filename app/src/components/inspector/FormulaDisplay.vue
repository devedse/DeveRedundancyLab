<script setup lang="ts">
import type { FormulaLine } from '@/stores/calcEngine'
import type { CalcEngineMode } from '@/stores/calcEngine'

defineProps<{
  lines: FormulaLine[]
  currentLine: number
  mode: CalcEngineMode
}>()
</script>

<template>
  <div class="flex flex-col gap-1.5 overflow-hidden">
    <span class="text-[10px] text-text-muted uppercase font-semibold tracking-wider">
      Formula
    </span>
    <div class="flex-1 rounded bg-surface-0 border border-border p-2 overflow-y-auto font-mono text-sm leading-relaxed">
      <div
        v-for="(line, idx) in lines"
        :key="idx"
        class="formula-line"
        :class="{
          'opacity-100': idx <= currentLine,
          'opacity-0': idx > currentLine,
          'text-text-primary': line.type === 'symbolic' || line.type === 'hex',
          'text-text-secondary': line.type === 'binary',
          'text-accent font-semibold': line.type === 'result',
          'text-disk-failed': line.type === 'error',
        }"
      >
        {{ line.text }}
      </div>

      <!-- Empty state -->
      <div
        v-if="lines.length === 0"
        class="h-full flex items-center justify-center text-text-muted text-xs"
      >
        {{ mode === 'idle' ? 'Hover over a pixel to inspect its computation' : 'Waiting...' }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.formula-line {
  transition: opacity 0.15s ease;
  white-space: pre-wrap;
}
</style>
