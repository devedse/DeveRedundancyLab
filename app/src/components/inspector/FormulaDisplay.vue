<script setup lang="ts">
import type { FormulaLine } from '@/stores/calcEngine'
import type { CalcEngineMode } from '@/stores/calcEngine'
import type { BinaryVisualization } from '@/stores/calcEngine'
import { byteToCssColor } from '@/utils/palette'
import { toHex } from '@/utils/format'

defineProps<{
  lines: FormulaLine[]
  currentLine: number
  mode: CalcEngineMode
  visualization?: BinaryVisualization | null
}>()

/** Channel for each bit position (MSB first): RRRGGGBB */
const BIT_CHANNELS: ('r' | 'g' | 'b')[] = ['r', 'r', 'r', 'g', 'g', 'g', 'b', 'b']

function getBits(value: number): number[] {
  const bits: number[] = []
  for (let i = 7; i >= 0; i--) {
    bits.push((value >> i) & 1)
  }
  return bits
}
</script>

<template>
  <div class="flex flex-col gap-1.5 overflow-hidden">
    <span class="text-[10px] text-text-muted uppercase font-semibold tracking-wider">
      Formula
    </span>

    <div class="flex-1 rounded bg-surface-0 border border-border p-2 overflow-y-auto">
      <!-- Binary Visualization (primary view when available) -->
      <template v-if="visualization">
        <div class="text-[10px] text-text-muted mb-1.5 font-mono">
          {{ visualization.title }}
        </div>
        <div class="flex flex-col gap-0.5">
          <template v-for="(row, idx) in visualization.rows" :key="idx">
            <!-- Separator row -->
            <div v-if="row.isSeparator" class="flex items-center gap-1 h-4 my-0.5">
              <span class="w-14 shrink-0"></span>
              <div class="flex gap-px">
                <span
                  v-for="i in 8"
                  :key="i"
                  class="w-[16px] h-px bg-text-muted/40"
                />
              </div>
            </div>

            <!-- Data / result row -->
            <div
              v-else
              class="flex items-center gap-1"
              :class="row.isResult ? 'bit-result' : ''"
            >
              <!-- Label -->
              <span
                class="w-14 shrink-0 text-right text-[10px] font-mono truncate"
                :class="row.isResult ? 'text-accent font-semibold' : 'text-text-muted'"
              >{{ row.label }}</span>

              <!-- 8 bit cells -->
              <div v-if="row.value !== null" class="flex gap-px">
                <span
                  v-for="(bit, bi) in getBits(row.product ?? row.value)"
                  :key="bi"
                  class="bit-cell w-[16px] h-[18px] flex items-center justify-center text-[11px] font-mono leading-none rounded-sm"
                  :class="[
                    BIT_CHANNELS[bi] === 'r' ? (bit ? 'bit-r-1' : 'bit-r-0') : '',
                    BIT_CHANNELS[bi] === 'g' ? (bit ? 'bit-g-1' : 'bit-g-0') : '',
                    BIT_CHANNELS[bi] === 'b' ? (bit ? 'bit-b-1' : 'bit-b-0') : '',
                    row.isResult ? 'font-bold' : '',
                  ]"
                >{{ bit }}</span>
              </div>
              <!-- Missing value -->
              <div v-else class="flex gap-px">
                <span
                  v-for="i in 8"
                  :key="i"
                  class="bit-cell w-[16px] h-[18px] flex items-center justify-center text-[11px] font-mono leading-none rounded-sm bg-surface-3/50 text-text-muted"
                >?</span>
              </div>

              <!-- Hex value -->
              <span
                v-if="row.value !== null"
                class="text-[10px] font-mono ml-1"
                :class="row.isResult ? 'text-accent' : 'text-text-muted'"
              >{{ toHex(row.product ?? row.value) }}</span>
              <span v-else class="text-[10px] font-mono ml-1 text-text-muted">??</span>

              <!-- GF coefficient badge (for Q/RS) -->
              <span
                v-if="row.coeff != null"
                class="text-[9px] font-mono px-1 rounded bg-purple-900/30 text-purple-300"
                :title="`GF coefficient: ${toHex(row.coeff)}`"
              >×{{ toHex(row.coeff) }}</span>

              <!-- Color swatch -->
              <div
                v-if="(row.product ?? row.value) !== null"
                class="w-3 h-3 rounded-sm shrink-0 border border-white/10"
                :style="{ backgroundColor: byteToCssColor((row.product ?? row.value)!) }"
              />
            </div>
          </template>
        </div>

        <!-- Channel legend -->
        <div class="flex gap-3 mt-2 text-[9px] font-mono text-text-muted">
          <span><span class="text-red-400">■</span> R [7:5]</span>
          <span><span class="text-green-400">■</span> G [4:2]</span>
          <span><span class="text-blue-400">■</span> B [1:0]</span>
        </div>
      </template>

      <!-- Fallback: text-only formula lines -->
      <template v-else>
        <div
          v-for="(line, idx) in lines"
          :key="idx"
          class="formula-line font-mono text-sm leading-relaxed"
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
      </template>

      <!-- Empty state -->
      <div
        v-if="!visualization && lines.length === 0"
        class="h-full flex items-center justify-center text-text-muted text-xs"
      >
        {{ mode === 'idle' ? 'Hover over a pixel to inspect' : 'Waiting...' }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.formula-line {
  transition: opacity 0.15s ease;
  white-space: pre-wrap;
}

/* Bit cell base */
.bit-cell {
  transition: background-color 0.1s ease;
}

/* Red channel bits */
.bit-r-1 { color: #f87171; background: rgba(248, 113, 113, 0.18); }
.bit-r-0 { color: #f8717180; background: rgba(248, 113, 113, 0.06); }

/* Green channel bits */
.bit-g-1 { color: #4ade80; background: rgba(74, 222, 128, 0.18); }
.bit-g-0 { color: #4ade8080; background: rgba(74, 222, 128, 0.06); }

/* Blue channel bits */
.bit-b-1 { color: #60a5fa; background: rgba(96, 165, 250, 0.18); }
.bit-b-0 { color: #60a5fa80; background: rgba(96, 165, 250, 0.06); }

/* Result row glow */
.bit-result {
  position: relative;
}
.bit-result::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: 4px;
  background: rgba(108, 140, 255, 0.08);
  pointer-events: none;
}
</style>
