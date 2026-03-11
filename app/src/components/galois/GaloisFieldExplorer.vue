<script setup lang="ts">
import { ref, computed } from 'vue'
import { gfAdd, gfMul, gfDiv, gfInverse } from '@/engine/gf256'
import { toHex, toBinary } from '@/utils/format'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const inputA = ref(0xa3)
const inputB = ref(0x7f)

const results = computed(() => ({
  add: gfAdd(inputA.value, inputB.value),
  mul: gfMul(inputA.value, inputB.value),
  div: inputB.value !== 0 ? gfDiv(inputA.value, inputB.value) : null,
  invA: inputA.value !== 0 ? gfInverse(inputA.value) : null,
  invB: inputB.value !== 0 ? gfInverse(inputB.value) : null,
}))

// Small multiplication table (16×16 excerpt of first 16 elements)
const TABLE_SIZE = 16
const mulTable = computed(() => {
  const rows: number[][] = []
  for (let r = 0; r < TABLE_SIZE; r++) {
    const row: number[] = []
    for (let c = 0; c < TABLE_SIZE; c++) {
      row.push(gfMul(r, c))
    }
    rows.push(row)
  }
  return rows
})

function toPolyString(val: number): string {
  if (val === 0) return '0'
  const terms: string[] = []
  for (let i = 7; i >= 0; i--) {
    if (val & (1 << i)) {
      if (i === 0) terms.push('1')
      else if (i === 1) terms.push('x')
      else terms.push(`x${i}`)
    }
  }
  return terms.join(' + ')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      @click.self="emit('close')"
    >
      <div class="bg-surface-1 rounded-xl border border-border shadow-2xl w-[700px] max-h-[80vh] overflow-y-auto">
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 class="text-base font-semibold text-text-primary">🔬 GF(2⁸) Explorer</h2>
          <button
            class="text-text-muted hover:text-text-primary text-xl leading-none"
            @click="emit('close')"
          >×</button>
        </div>

        <div class="p-5 space-y-5">
          <!-- Calculator -->
          <section>
            <h3 class="text-sm font-semibold text-text-secondary mb-2">Calculator</h3>
            <div class="flex items-center gap-3 mb-3">
              <label class="flex items-center gap-1.5 text-xs text-text-secondary">
                A:
                <input
                  v-model.number="inputA"
                  type="number"
                  min="0"
                  max="255"
                  class="w-16 rounded bg-surface-2 border border-border px-2 py-1 text-sm font-mono text-text-primary text-center"
                />
                <span class="font-mono text-text-muted">{{ toHex(inputA) }}</span>
              </label>
              <label class="flex items-center gap-1.5 text-xs text-text-secondary">
                B:
                <input
                  v-model.number="inputB"
                  type="number"
                  min="0"
                  max="255"
                  class="w-16 rounded bg-surface-2 border border-border px-2 py-1 text-sm font-mono text-text-primary text-center"
                />
                <span class="font-mono text-text-muted">{{ toHex(inputB) }}</span>
              </label>
            </div>

            <div class="grid grid-cols-2 gap-2 text-xs font-mono">
              <div class="rounded bg-surface-2 px-3 py-2">
                <span class="text-text-muted">A ⊕ B = </span>
                <span class="text-text-primary">{{ toHex(results.add) }} ({{ toBinary(results.add) }})</span>
              </div>
              <div class="rounded bg-surface-2 px-3 py-2">
                <span class="text-text-muted">A ⊗ B = </span>
                <span class="text-text-primary">{{ toHex(results.mul) }} ({{ toBinary(results.mul) }})</span>
              </div>
              <div class="rounded bg-surface-2 px-3 py-2">
                <span class="text-text-muted">A / B = </span>
                <span class="text-text-primary">{{ results.div !== null ? toHex(results.div) : 'N/A' }}</span>
              </div>
              <div class="rounded bg-surface-2 px-3 py-2">
                <span class="text-text-muted">A⁻¹ = </span>
                <span class="text-text-primary">{{ results.invA !== null ? toHex(results.invA) : 'N/A' }}</span>
              </div>
            </div>
          </section>

          <!-- Polynomial View -->
          <section>
            <h3 class="text-sm font-semibold text-text-secondary mb-2">Polynomial Representation</h3>
            <div class="text-xs font-mono text-text-primary space-y-1">
              <div>A = {{ toHex(inputA) }} = {{ toBinary(inputA) }} = {{ toPolyString(inputA) }}</div>
              <div>B = {{ toHex(inputB) }} = {{ toBinary(inputB) }} = {{ toPolyString(inputB) }}</div>
            </div>
            <div class="mt-1 text-[10px] text-text-muted">
              Primitive polynomial: x⁸ + x⁴ + x³ + x² + 1 (0x11D)
            </div>
          </section>

          <!-- Multiplication Table (16×16 excerpt) -->
          <section>
            <h3 class="text-sm font-semibold text-text-secondary mb-2">
              Multiplication Table (0×0 .. F×F)
            </h3>
            <div class="overflow-auto">
              <table class="text-[10px] font-mono border-collapse">
                <thead>
                  <tr>
                    <th class="gf-cell bg-surface-3 text-text-muted">⊗</th>
                    <th
                      v-for="c in TABLE_SIZE"
                      :key="c"
                      class="gf-cell bg-surface-3 text-text-secondary"
                    >{{ (c - 1).toString(16).toUpperCase() }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, r) in mulTable" :key="r">
                    <td class="gf-cell bg-surface-3 text-text-secondary font-semibold">
                      {{ r.toString(16).toUpperCase() }}
                    </td>
                    <td
                      v-for="(val, c) in row"
                      :key="c"
                      class="gf-cell"
                      :title="`${r.toString(16)} × ${c.toString(16)} = ${val.toString(16)}`"
                    >{{ val.toString(16).toUpperCase().padStart(2, '0') }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
@reference "../../style.css";
.gf-cell {
  @apply px-1.5 py-0.5 text-center border border-border/40 text-text-primary;
  min-width: 28px;
}
</style>
