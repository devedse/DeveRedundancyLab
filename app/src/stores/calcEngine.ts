import { defineStore } from 'pinia'
import { ref } from 'vue'

export type CalcEngineMode =
  | 'idle'
  | 'parity'
  | 'recovery'
  | 'failed-recovery'
  | 'repair'
  | 'hover'

export type CalcInputStatus = 'filled' | 'missing' | 'corrupted' | 'pending'
export type CalcOutputStatus = 'computed' | 'failed'
export type FormulaLineType = 'symbolic' | 'hex' | 'binary' | 'result' | 'error'

export interface CalcInput {
  disk: number
  value: number | null
  label: string
  status: CalcInputStatus
}

export interface CalcOutput {
  value: number | null
  label: string
  targetDisk: number
  status: CalcOutputStatus
}

export interface FormulaLine {
  text: string
  type: FormulaLineType
  delay: number
}

export const useCalcEngineStore = defineStore('calcEngine', () => {
  const visible = ref(false)
  const pinned = ref(false)
  const mode = ref<CalcEngineMode>('idle')

  const inputs = ref<CalcInput[]>([])
  const formulaLines = ref<FormulaLine[]>([])
  const currentLine = ref(-1)
  const outputs = ref<CalcOutput[]>([])

  const stripeIndex = ref(0)
  const bytePosition = ref(0)

  function setInputs(newInputs: CalcInput[]) {
    inputs.value = newInputs
  }

  function setFormula(lines: FormulaLine[]) {
    formulaLines.value = lines
    currentLine.value = -1
  }

  function advanceLine() {
    if (currentLine.value < formulaLines.value.length - 1) {
      currentLine.value++
    }
  }

  function setOutputs(newOutputs: CalcOutput[]) {
    outputs.value = newOutputs
  }

  function showForHover(
    stripe: number,
    byte: number,
    calcInputs: CalcInput[],
    lines: FormulaLine[],
    calcOutputs: CalcOutput[],
  ) {
    mode.value = 'hover'
    stripeIndex.value = stripe
    bytePosition.value = byte
    inputs.value = calcInputs
    formulaLines.value = lines
    currentLine.value = lines.length - 1 // Show all lines instantly
    outputs.value = calcOutputs
    visible.value = true
  }

  function clear() {
    if (pinned.value) return
    mode.value = 'idle'
    inputs.value = []
    formulaLines.value = []
    currentLine.value = -1
    outputs.value = []
    visible.value = false
  }

  function $reset() {
    visible.value = false
    pinned.value = false
    mode.value = 'idle'
    inputs.value = []
    formulaLines.value = []
    currentLine.value = -1
    outputs.value = []
    stripeIndex.value = 0
    bytePosition.value = 0
  }

  return {
    visible,
    pinned,
    mode,
    inputs,
    formulaLines,
    currentLine,
    outputs,
    stripeIndex,
    bytePosition,
    setInputs,
    setFormula,
    advanceLine,
    setOutputs,
    showForHover,
    clear,
    $reset,
  }
})
