<script setup lang="ts">
import type { CalcOutput } from '@/stores/calcEngine'
import { toHex } from '@/utils/format'
import { byteToCssColor } from '@/utils/palette'

defineProps<{ outputs: CalcOutput[] }>()

const BIT_CH: ('r' | 'g' | 'b')[] = ['r', 'r', 'r', 'g', 'g', 'g', 'b', 'b']

function getBits(v: number): number[] {
  const b: number[] = []
  for (let i = 7; i >= 0; i--) b.push((v >> i) & 1)
  return b
}
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
        class="output-slot flex items-center gap-1.5 rounded px-1.5 py-1.5"
        :class="{
          'bg-surface-2 border border-accent/30': output.status === 'computed',
          'bg-red-950/30 border border-disk-failed/50': output.status === 'failed',
        }"
      >
        <!-- Label -->
        <span
          class="text-[10px] font-mono w-6 shrink-0 text-right"
          :class="output.status === 'computed' ? 'text-accent font-semibold' : 'text-disk-failed'"
        >{{ output.label }}</span>

        <!-- Bit cells -->
        <div v-if="output.value !== null" class="flex gap-px">
          <span
            v-for="(bit, bi) in getBits(output.value)"
            :key="bi"
            class="w-[12px] h-[14px] flex items-center justify-center text-[9px] font-mono leading-none rounded-sm"
            :class="[
              BIT_CH[bi] === 'r' ? (bit ? 'bit-r-1' : 'bit-r-0') : '',
              BIT_CH[bi] === 'g' ? (bit ? 'bit-g-1' : 'bit-g-0') : '',
              BIT_CH[bi] === 'b' ? (bit ? 'bit-b-1' : 'bit-b-0') : '',
            ]"
          >{{ bit }}</span>
        </div>
        <div v-else class="flex gap-px">
          <span
            v-for="i in 8"
            :key="i"
            class="w-[12px] h-[14px] flex items-center justify-center text-[9px] font-mono leading-none rounded-sm bg-surface-3/50 text-text-muted"
          >?</span>
        </div>

        <!-- Color swatch -->
        <div
          v-if="output.value !== null"
          class="w-3 h-3 rounded-sm shrink-0 border border-white/10"
          :style="{ backgroundColor: byteToCssColor(output.value) }"
        />
        <div v-else class="w-3 h-3 rounded-sm shrink-0 bg-surface-3/50" />

        <!-- Hex -->
        <span
          class="text-[10px] font-mono shrink-0"
          :class="output.status === 'computed' ? 'text-accent' : 'text-disk-failed'"
        >{{ output.value !== null ? toHex(output.value) : 'FAIL' }}</span>
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
.bit-r-1 { color: #f87171; background: rgba(248, 113, 113, 0.18); }
.bit-r-0 { color: #f8717180; background: rgba(248, 113, 113, 0.06); }
.bit-g-1 { color: #4ade80; background: rgba(74, 222, 128, 0.18); }
.bit-g-0 { color: #4ade8080; background: rgba(74, 222, 128, 0.06); }
.bit-b-1 { color: #60a5fa; background: rgba(96, 165, 250, 0.18); }
.bit-b-0 { color: #60a5fa80; background: rgba(96, 165, 250, 0.06); }
</style>
