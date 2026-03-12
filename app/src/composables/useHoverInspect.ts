/**
 * Composable that populates the Calculation Engine panel when hovering
 * over a pixel in a disk's PixelGrid.
 */
import { useVolumeStore } from '@/stores/volume'
import { useDiskStore } from '@/stores/disks'
import { useCalcEngineStore } from '@/stores/calcEngine'
import type { CalcInput, CalcOutput, FormulaLine, BinaryVisualization, BitRow } from '@/stores/calcEngine'
import { raid5Layout, raid6Layout } from '@/engine/raid'
import { gfMul, gfPow, gfAdd } from '@/engine/gf256'
import { buildEncodingMatrix } from '@/engine/reedsolomon'
import { toHex } from '@/utils/format'

/**
 * Show the calculation engine for a given pixel on a given disk.
 */
export function inspectPixel(diskId: number, pixelIndex: number) {
  const volume = useVolumeStore()
  const diskStore = useDiskStore()
  const calcEngine = useCalcEngineStore()

  const { dataDisks, blockSize, totalDisks, algorithm } = volume

  // Determine which stripe and byte position this pixel belongs to
  const stripeIndex = Math.floor(pixelIndex / blockSize)
  const bytePos = pixelIndex % blockSize

  if (algorithm === 'raid5') {
    inspectRaid5(diskId, stripeIndex, bytePos, totalDisks, blockSize, diskStore, calcEngine)
  } else if (algorithm === 'raid6') {
    inspectRaid6(diskId, stripeIndex, bytePos, totalDisks, blockSize, diskStore, calcEngine)
  } else {
    inspectRS(diskId, stripeIndex, bytePos, dataDisks, volume.parityDisks, blockSize, diskStore, calcEngine)
  }
}

/** Read a byte from a disk at a given stripe + byte position, or null if failed. */
function readByte(
  diskStore: ReturnType<typeof useDiskStore>,
  diskId: number,
  stripeIndex: number,
  bytePos: number,
  blockSize: number,
): number | null {
  const disk = diskStore.disks[diskId]
  if (disk.status === 'failed') return null
  return disk.pixels[stripeIndex * blockSize + bytePos] ?? null
}

// ─── RAID 5 ──────────────────────────────────────────────────────────

function inspectRaid5(
  diskId: number,
  stripeIndex: number,
  bytePos: number,
  totalDisks: number,
  blockSize: number,
  diskStore: ReturnType<typeof useDiskStore>,
  calcEngine: ReturnType<typeof useCalcEngineStore>,
) {
  const layout = raid5Layout(totalDisks, stripeIndex)
  const isParityDisk = layout.parityP === diskId

  const inputs: CalcInput[] = []
  const formulaLines: FormulaLine[] = []
  const outputs: CalcOutput[] = []

  // Gather data disk values
  const dataValues: { label: string; value: number | null; diskId: number }[] = []
  for (const di of layout.dataDisks) {
    const disk = diskStore.disks[di]
    const val = readByte(diskStore, di, stripeIndex, bytePos, blockSize)
    dataValues.push({ label: `D${di}`, value: val, diskId: di })
    inputs.push({
      disk: di,
      value: val,
      label: `D${di}`,
      status: disk.status === 'failed' ? 'missing' : 'filled',
    })
  }

  if (isParityDisk) {
    const parityVal = readByte(diskStore, layout.parityP, stripeIndex, bytePos, blockSize)

    const hexParts = dataValues.filter(d => d.value !== null).map(d => toHex(d.value!))
    formulaLines.push(
      { text: `P = ${dataValues.map(d => d.label).join(' ⊕ ')}`, type: 'symbolic', delay: 0 },
      { text: `P = ${hexParts.join(' ⊕ ')}`, type: 'hex', delay: 100 },
      { text: `P = ${parityVal !== null ? toHex(parityVal) : '??'}`, type: 'result', delay: 200 },
    )
    outputs.push({ value: parityVal, label: 'P', targetDisk: layout.parityP, status: 'computed' })

    // Binary XOR visualization
    const vizRows: BitRow[] = dataValues.map(d => ({
      label: d.label,
      value: d.value,
    }))
    vizRows.push({ label: '', value: null, isSeparator: true })

    // Compute XOR of all data values
    let xorResult = 0
    for (const d of dataValues) {
      if (d.value !== null) xorResult ^= d.value
    }
    vizRows.push({ label: 'P', value: parityVal ?? xorResult, isResult: true })

    const viz: BinaryVisualization = {
      title: `Stripe ${stripeIndex}, Byte ${bytePos} — XOR Parity`,
      rows: vizRows,
    }
    calcEngine.showForHover(stripeIndex, bytePos, inputs, formulaLines, outputs, viz)
  } else {
    // Hovering over data — show XOR relationship
    const parityDisk = diskStore.disks[layout.parityP]
    const parityVal = readByte(diskStore, layout.parityP, stripeIndex, bytePos, blockSize)
    inputs.push({
      disk: layout.parityP,
      value: parityVal,
      label: 'P',
      status: parityDisk.status === 'failed' ? 'missing' : 'filled',
    })

    const val = readByte(diskStore, diskId, stripeIndex, bytePos, blockSize)
    formulaLines.push(
      { text: `Stripe ${stripeIndex}, Byte ${bytePos}`, type: 'symbolic', delay: 0 },
      { text: `${inputs.map(i => i.label).join(' ⊕ ')} = 0 (parity check)`, type: 'symbolic', delay: 100 },
      { text: `D${diskId}[${bytePos}] = ${val !== null ? toHex(val) : '??'}`, type: 'result', delay: 200 },
    )
    outputs.push({ value: val, label: `D${diskId}`, targetDisk: diskId, status: 'computed' })

    // Binary: show all data + parity → XOR = 0 check
    const vizRows: BitRow[] = dataValues.map(d => ({
      label: d.label,
      value: d.value,
    }))
    vizRows.push({ label: 'P', value: parityVal })
    vizRows.push({ label: '', value: null, isSeparator: true })

    let checkXor = 0
    for (const d of dataValues) {
      if (d.value !== null) checkXor ^= d.value
    }
    if (parityVal !== null) checkXor ^= parityVal
    vizRows.push({ label: '⊕=', value: checkXor, isResult: true })

    const viz: BinaryVisualization = {
      title: `Stripe ${stripeIndex}, Byte ${bytePos} — XOR Check`,
      rows: vizRows,
    }
    calcEngine.showForHover(stripeIndex, bytePos, inputs, formulaLines, outputs, viz)
  }
}

// ─── RAID 6 ──────────────────────────────────────────────────────────

function inspectRaid6(
  diskId: number,
  stripeIndex: number,
  bytePos: number,
  totalDisks: number,
  blockSize: number,
  diskStore: ReturnType<typeof useDiskStore>,
  calcEngine: ReturnType<typeof useCalcEngineStore>,
) {
  const layout = raid6Layout(totalDisks, stripeIndex)
  const isParityP = layout.parityP === diskId
  const isParityQ = layout.parityQ === diskId

  const inputs: CalcInput[] = []
  const formulaLines: FormulaLine[] = []
  const outputs: CalcOutput[] = []

  // Gather data disk values
  const dataValues: { label: string; value: number | null; diskId: number }[] = []
  for (const di of layout.dataDisks) {
    const disk = diskStore.disks[di]
    const val = readByte(diskStore, di, stripeIndex, bytePos, blockSize)
    dataValues.push({ label: `D${di}`, value: val, diskId: di })
    inputs.push({
      disk: di,
      value: val,
      label: `D${di}`,
      status: disk.status === 'failed' ? 'missing' : 'filled',
    })
  }

  if (isParityP) {
    const parityVal = readByte(diskStore, layout.parityP, stripeIndex, bytePos, blockSize)
    const hexParts = dataValues.filter(d => d.value !== null).map(d => toHex(d.value!))
    formulaLines.push(
      { text: `P = ${dataValues.map(d => d.label).join(' ⊕ ')}`, type: 'symbolic', delay: 0 },
      { text: `P = ${hexParts.join(' ⊕ ')}`, type: 'hex', delay: 100 },
      { text: `P = ${parityVal !== null ? toHex(parityVal) : '??'}`, type: 'result', delay: 200 },
    )
    outputs.push({ value: parityVal, label: 'P', targetDisk: layout.parityP, status: 'computed' })

    // Same XOR visualization as RAID 5 P
    const vizRows: BitRow[] = dataValues.map(d => ({ label: d.label, value: d.value }))
    vizRows.push({ label: '', value: null, isSeparator: true })
    let xorResult = 0
    for (const d of dataValues) { if (d.value !== null) xorResult ^= d.value }
    vizRows.push({ label: 'P', value: parityVal ?? xorResult, isResult: true })

    calcEngine.showForHover(stripeIndex, bytePos, inputs, formulaLines, outputs, {
      title: `Stripe ${stripeIndex}, Byte ${bytePos} — XOR Parity (P)`,
      rows: vizRows,
    })
  } else if (isParityQ) {
    const qVal = readByte(diskStore, layout.parityQ!, stripeIndex, bytePos, blockSize)

    // Show GF-weighted sum for Q
    formulaLines.push(
      { text: `Q = Σ (2^j · Dⱼ) over GF(2⁸)`, type: 'symbolic', delay: 0 },
    )
    const vizRows: BitRow[] = []
    let qAccum = 0
    for (let j = 0; j < dataValues.length; j++) {
      const d = dataValues[j]
      const coeff = gfPow(2, j)
      const product = d.value !== null ? gfMul(coeff, d.value) : null
      if (product !== null) qAccum = gfAdd(qAccum, product)

      formulaLines.push({
        text: `  2^${j}·${d.label} = ${toHex(coeff)}×${d.value !== null ? toHex(d.value) : '??'} = ${product !== null ? toHex(product) : '??'}`,
        type: 'hex',
        delay: 50 * (j + 1),
      })

      vizRows.push({
        label: `g${superscript(j)}·${d.label}`,
        value: d.value,
        coeff,
        product: product ?? undefined,
      })
    }
    vizRows.push({ label: '', value: null, isSeparator: true })
    vizRows.push({ label: 'Q', value: qVal ?? qAccum, isResult: true })

    formulaLines.push({ text: `Q = ${qVal !== null ? toHex(qVal) : '??'}`, type: 'result', delay: 50 * (dataValues.length + 1) })
    outputs.push({ value: qVal, label: 'Q', targetDisk: layout.parityQ!, status: 'computed' })

    calcEngine.showForHover(stripeIndex, bytePos, inputs, formulaLines, outputs, {
      title: `Stripe ${stripeIndex}, Byte ${bytePos} — Q Syndrome (GF)`,
      rows: vizRows,
    })
  } else {
    // Hovering over data disk
    const val = readByte(diskStore, diskId, stripeIndex, bytePos, blockSize)
    formulaLines.push(
      { text: `Stripe ${stripeIndex}, Byte ${bytePos}`, type: 'symbolic', delay: 0 },
      { text: `D${diskId}[${bytePos}] = ${val !== null ? toHex(val) : '??'}`, type: 'result', delay: 100 },
    )
    outputs.push({ value: val, label: `D${diskId}`, targetDisk: diskId, status: 'computed' })

    // Show XOR parity check and Q check side by side
    const parityPVal = readByte(diskStore, layout.parityP, stripeIndex, bytePos, blockSize)
    const vizRows: BitRow[] = dataValues.map(d => ({ label: d.label, value: d.value }))
    vizRows.push({ label: 'P', value: parityPVal })
    vizRows.push({ label: '', value: null, isSeparator: true })
    let checkXor = 0
    for (const d of dataValues) { if (d.value !== null) checkXor ^= d.value }
    if (parityPVal !== null) checkXor ^= parityPVal
    vizRows.push({ label: '⊕=', value: checkXor, isResult: true })

    calcEngine.showForHover(stripeIndex, bytePos, inputs, formulaLines, outputs, {
      title: `Stripe ${stripeIndex}, Byte ${bytePos} — Parity Check`,
      rows: vizRows,
    })
  }
}

// ─── Reed-Solomon ────────────────────────────────────────────────────

function inspectRS(
  diskId: number,
  stripeIndex: number,
  bytePos: number,
  dataDisks: number,
  parityDisks: number,
  blockSize: number,
  diskStore: ReturnType<typeof useDiskStore>,
  calcEngine: ReturnType<typeof useCalcEngineStore>,
) {
  const totalShards = dataDisks + parityDisks
  const inputs: CalcInput[] = []
  const formulaLines: FormulaLine[] = []
  const outputs: CalcOutput[] = []

  const dataValues: { label: string; value: number | null; diskId: number }[] = []
  for (let d = 0; d < totalShards; d++) {
    const disk = diskStore.disks[d]
    const val = readByte(diskStore, d, stripeIndex, bytePos, blockSize)
    const isData = d < dataDisks
    const label = isData ? `D${d}` : `P${d - dataDisks}`
    dataValues.push({ label, value: val, diskId: d })
    inputs.push({
      disk: d,
      value: val,
      label,
      status: disk.status === 'failed' ? 'missing' : 'filled',
    })
  }

  const val = readByte(diskStore, diskId, stripeIndex, bytePos, blockSize)
  const isData = diskId < dataDisks
  const selfLabel = isData ? `D${diskId}` : `P${diskId - dataDisks}`

  if (!isData) {
    // Hovering over a parity disk — show how this parity row was computed
    const parityIdx = diskId - dataDisks
    const matrix = buildEncodingMatrix(dataDisks, parityDisks)
    const matrixRow = matrix[dataDisks + parityIdx]

    formulaLines.push(
      { text: `${selfLabel} = Σ cᵢ·Dᵢ  (Cauchy over GF(2⁸))`, type: 'symbolic', delay: 0 },
    )

    const vizRows: BitRow[] = []
    let accum = 0
    for (let c = 0; c < dataDisks; c++) {
      const coeff = matrixRow[c]
      const dVal = dataValues[c].value
      const product = dVal !== null ? gfMul(coeff, dVal) : null
      if (product !== null) accum = gfAdd(accum, product)

      formulaLines.push({
        text: `  c${subscript(c)}·D${c} = ${toHex(coeff)}×${dVal !== null ? toHex(dVal) : '??'} = ${product !== null ? toHex(product) : '??'}`,
        type: 'hex',
        delay: 50 * (c + 1),
      })

      vizRows.push({
        label: `c${subscript(c)}·D${c}`,
        value: dVal,
        coeff,
        product: product ?? undefined,
      })
    }
    vizRows.push({ label: '', value: null, isSeparator: true })
    vizRows.push({ label: selfLabel, value: val ?? accum, isResult: true })

    formulaLines.push({
      text: `${selfLabel} = ${val !== null ? toHex(val) : '??'}`,
      type: 'result',
      delay: 50 * (dataDisks + 1),
    })
    outputs.push({ value: val, label: selfLabel, targetDisk: diskId, status: 'computed' })

    calcEngine.showForHover(stripeIndex, bytePos, inputs, formulaLines, outputs, {
      title: `Stripe ${stripeIndex}, Byte ${bytePos} — RS Encoding (${selfLabel})`,
      rows: vizRows,
    })
  } else {
    // Hovering over a data disk — show the data value + matrix context
    formulaLines.push(
      { text: `Reed-Solomon: Stripe ${stripeIndex}, Byte ${bytePos}`, type: 'symbolic', delay: 0 },
      { text: `Cauchy matrix (${dataDisks}+${parityDisks})×${dataDisks}`, type: 'symbolic', delay: 100 },
      { text: `${selfLabel}[${bytePos}] = ${val !== null ? toHex(val) : '??'}`, type: 'result', delay: 200 },
    )
    outputs.push({ value: val, label: selfLabel, targetDisk: diskId, status: 'computed' })

    // Show all data values for stripe context
    const vizRows: BitRow[] = []
    for (let c = 0; c < dataDisks; c++) {
      vizRows.push({ label: `D${c}`, value: dataValues[c].value })
    }

    calcEngine.showForHover(stripeIndex, bytePos, inputs, formulaLines, outputs, {
      title: `Stripe ${stripeIndex}, Byte ${bytePos} — Data`,
      rows: vizRows,
    })
  }
}

function superscript(n: number): string {
  const chars = '⁰¹²³⁴⁵⁶⁷⁸⁹'
  return String(n).split('').map(d => chars[parseInt(d)]).join('')
}

function subscript(n: number): string {
  const chars = '₀₁₂₃₄₅₆₇₈₉'
  return String(n).split('').map(d => chars[parseInt(d)]).join('')
}

export function clearInspection() {
  const calcEngine = useCalcEngineStore()
  calcEngine.clear()
}
