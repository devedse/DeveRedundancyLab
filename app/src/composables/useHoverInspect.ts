/**
 * Composable that populates the Calculation Engine panel when hovering
 * over a pixel in a disk's PixelGrid.
 */
import { useVolumeStore } from '@/stores/volume'
import { useDiskStore } from '@/stores/disks'
import { useCalcEngineStore } from '@/stores/calcEngine'
import type { CalcInput, CalcOutput, FormulaLine } from '@/stores/calcEngine'
import { raid5Layout, raid6Layout } from '@/engine/raid'
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

  if (isParityDisk) {
    // Hovering over parity — show how it was computed from data blocks
    for (let d = 0; d < layout.dataDisks.length; d++) {
      const di = layout.dataDisks[d]
      const disk = diskStore.disks[di]
      const val = disk.status !== 'failed' ? disk.pixels[stripeIndex * blockSize + bytePos] : null
      inputs.push({
        disk: di,
        value: val,
        label: `D${di}`,
        status: disk.status === 'failed' ? 'missing' : 'filled',
      })
    }

    const parityDisk = diskStore.disks[layout.parityP]
    const parityVal = parityDisk.pixels[stripeIndex * blockSize + bytePos]

    // Formula: P = D0 XOR D1 XOR D2 ...
    const hexParts = inputs.filter(i => i.value !== null).map(i => toHex(i.value!))
    formulaLines.push(
      { text: `P = ${inputs.map(i => i.label).join(' ⊕ ')}`, type: 'symbolic', delay: 0 },
      { text: `P = ${hexParts.join(' ⊕ ')}`, type: 'hex', delay: 100 },
      { text: `P = ${toHex(parityVal)}`, type: 'result', delay: 200 },
    )

    outputs.push({ value: parityVal, label: 'P', targetDisk: layout.parityP, status: 'computed' })
  } else {
    // Hovering over data — show the XOR relationship
    const dataIdx = layout.dataDisks.indexOf(diskId)
    for (let d = 0; d < layout.dataDisks.length; d++) {
      const di = layout.dataDisks[d]
      const disk = diskStore.disks[di]
      const val = disk.status !== 'failed' ? disk.pixels[stripeIndex * blockSize + bytePos] : null
      inputs.push({
        disk: di,
        value: val,
        label: `D${di}`,
        status: disk.status === 'failed' ? 'missing' : d === dataIdx ? 'filled' : 'filled',
      })
    }

    // Add parity as input too
    const parityDisk = diskStore.disks[layout.parityP]
    const parityVal = parityDisk.status !== 'failed' ? parityDisk.pixels[stripeIndex * blockSize + bytePos] : null
    inputs.push({
      disk: layout.parityP,
      value: parityVal,
      label: 'P',
      status: parityDisk.status === 'failed' ? 'missing' : 'filled',
    })

    const disk = diskStore.disks[diskId]
    const val = disk.pixels[stripeIndex * blockSize + bytePos]

    formulaLines.push(
      { text: `Stripe ${stripeIndex}, Byte ${bytePos}`, type: 'symbolic', delay: 0 },
      { text: `${inputs.map(i => i.label).join(' ⊕ ')} = 0 (parity check)`, type: 'symbolic', delay: 100 },
      { text: `D${diskId}[${bytePos}] = ${toHex(val)}`, type: 'result', delay: 200 },
    )

    outputs.push({ value: val, label: `D${diskId}`, targetDisk: diskId, status: 'computed' })
  }

  calcEngine.showForHover(stripeIndex, bytePos, inputs, formulaLines, outputs)
}

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

  // Gather all data inputs
  for (let d = 0; d < layout.dataDisks.length; d++) {
    const di = layout.dataDisks[d]
    const disk = diskStore.disks[di]
    const val = disk.status !== 'failed' ? disk.pixels[stripeIndex * blockSize + bytePos] : null
    inputs.push({
      disk: di,
      value: val,
      label: `D${di}`,
      status: disk.status === 'failed' ? 'missing' : 'filled',
    })
  }

  if (isParityP) {
    const parityVal = diskStore.disks[layout.parityP].pixels[stripeIndex * blockSize + bytePos]
    formulaLines.push(
      { text: `P = ${inputs.map(i => i.label).join(' ⊕ ')}`, type: 'symbolic', delay: 0 },
      { text: `P = ${toHex(parityVal)}`, type: 'result', delay: 100 },
    )
    outputs.push({ value: parityVal, label: 'P', targetDisk: layout.parityP, status: 'computed' })
  } else if (isParityQ) {
    const qVal = diskStore.disks[layout.parityQ!].pixels[stripeIndex * blockSize + bytePos]
    const qParts = inputs.map((inp, j) => `g${j}·${inp.label}`)
    formulaLines.push(
      { text: `Q = ${qParts.join(' ⊕ ')}`, type: 'symbolic', delay: 0 },
      { text: `Q = Σ(2^j · Dj) over GF(2⁸)`, type: 'symbolic', delay: 100 },
      { text: `Q = ${toHex(qVal)}`, type: 'result', delay: 200 },
    )
    outputs.push({ value: qVal, label: 'Q', targetDisk: layout.parityQ!, status: 'computed' })
  } else {
    const val = diskStore.disks[diskId].pixels[stripeIndex * blockSize + bytePos]
    formulaLines.push(
      { text: `Stripe ${stripeIndex}, Byte ${bytePos}`, type: 'symbolic', delay: 0 },
      { text: `D${diskId}[${bytePos}] = ${toHex(val)}`, type: 'result', delay: 100 },
    )
    outputs.push({ value: val, label: `D${diskId}`, targetDisk: diskId, status: 'computed' })
  }

  calcEngine.showForHover(stripeIndex, bytePos, inputs, formulaLines, outputs)
}

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

  for (let d = 0; d < totalShards; d++) {
    const disk = diskStore.disks[d]
    const val = disk.status !== 'failed' ? disk.pixels[stripeIndex * blockSize + bytePos] : null
    const isData = d < dataDisks
    inputs.push({
      disk: d,
      value: val,
      label: isData ? `D${d}` : `P${d - dataDisks}`,
      status: disk.status === 'failed' ? 'missing' : 'filled',
    })
  }

  const val = diskStore.disks[diskId].pixels[stripeIndex * blockSize + bytePos]
  const isData = diskId < dataDisks

  formulaLines.push(
    { text: `Reed-Solomon: Stripe ${stripeIndex}, Byte ${bytePos}`, type: 'symbolic', delay: 0 },
    { text: `Cauchy encoding matrix (${dataDisks}+${parityDisks})×${dataDisks}`, type: 'symbolic', delay: 100 },
    { text: `${isData ? `D${diskId}` : `P${diskId - dataDisks}`}[${bytePos}] = ${toHex(val)}`, type: 'result', delay: 200 },
  )

  outputs.push({
    value: val,
    label: isData ? `D${diskId}` : `P${diskId - dataDisks}`,
    targetDisk: diskId,
    status: 'computed',
  })

  calcEngine.showForHover(stripeIndex, bytePos, inputs, formulaLines, outputs)
}

export function clearInspection() {
  const calcEngine = useCalcEngineStore()
  calcEngine.clear()
}
