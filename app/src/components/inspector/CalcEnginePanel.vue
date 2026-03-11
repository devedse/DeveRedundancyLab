<script setup lang="ts">
import { useCalcEngineStore } from '@/stores/calcEngine'
import InputSlots from './InputSlots.vue'
import FormulaDisplay from './FormulaDisplay.vue'
import OutputSlots from './OutputSlots.vue'

const calcEngine = useCalcEngineStore()
</script>

<template>
  <div
    class="calc-engine border-t border-border bg-surface-1 transition-all duration-200"
    :class="calcEngine.visible ? 'h-44' : 'h-9'"
  >
    <!-- Title bar (always visible) -->
    <div
      class="flex items-center justify-between px-4 py-1.5 cursor-pointer select-none"
      @click="calcEngine.visible = !calcEngine.visible"
    >
      <div class="flex items-center gap-2">
        <span class="text-xs font-semibold text-text-secondary uppercase tracking-wider">
          Calculation Engine
        </span>
        <span
          v-if="calcEngine.mode !== 'idle'"
          class="rounded-full px-2 py-0.5 text-[10px] font-medium"
          :class="{
            'bg-disk-degraded/20 text-disk-degraded': calcEngine.mode === 'parity',
            'bg-disk-rebuilding/20 text-disk-rebuilding': calcEngine.mode === 'recovery',
            'bg-disk-failed/20 text-disk-failed': calcEngine.mode === 'failed-recovery',
            'bg-disk-corrupted/20 text-disk-corrupted': calcEngine.mode === 'repair',
            'bg-surface-3 text-text-secondary': calcEngine.mode === 'hover',
          }"
        >
          {{ calcEngine.mode }}
        </span>
      </div>
      <div class="flex items-center gap-2">
        <button
          v-if="calcEngine.pinned"
          class="text-xs text-text-muted hover:text-text-primary"
          title="Unpin"
          @click.stop="calcEngine.pinned = false"
        >📌</button>
        <span class="text-text-muted text-xs">
          {{ calcEngine.visible ? '▼' : '▲' }}
        </span>
      </div>
    </div>

    <!-- Content (shown when expanded) -->
    <div
      v-show="calcEngine.visible"
      class="flex items-stretch gap-4 px-4 pb-3 h-[calc(100%-36px)] overflow-hidden"
    >
      <!-- Input Slots -->
      <InputSlots :inputs="calcEngine.inputs" class="w-48 shrink-0" />

      <!-- Formula Area -->
      <FormulaDisplay
        :lines="calcEngine.formulaLines"
        :current-line="calcEngine.currentLine"
        :mode="calcEngine.mode"
        class="flex-1 min-w-0"
      />

      <!-- Output Slots -->
      <OutputSlots :outputs="calcEngine.outputs" class="w-40 shrink-0" />
    </div>
  </div>
</template>

<style scoped>
.calc-engine {
  overflow: hidden;
}
</style>
