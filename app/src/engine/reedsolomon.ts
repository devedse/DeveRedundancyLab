/**
 * Reed-Solomon erasure coding over GF(2⁸).
 *
 * Uses a Cauchy encoding matrix for better numerical properties.
 */
import { gfAdd, gfInverse, gfMul } from './gf256'

/**
 * Build a Cauchy encoding matrix for (dataCount + parityCount) × dataCount.
 * Top dataCount×dataCount rows are identity (systematic).
 * Bottom parityCount rows are Cauchy matrix entries: 1 / (x_i + y_j).
 */
export function buildEncodingMatrix(
  dataCount: number,
  parityCount: number,
): number[][] {
  const totalRows = dataCount + parityCount
  const matrix: number[][] = []

  // Identity rows for data
  for (let r = 0; r < dataCount; r++) {
    const row = new Array<number>(dataCount).fill(0)
    row[r] = 1
    matrix.push(row)
  }

  // Cauchy rows for parity
  // x_i = parityCount..parityCount+parityCount-1, y_j = 0..dataCount-1
  // To avoid collisions: x values start at dataCount
  for (let r = 0; r < parityCount; r++) {
    const row: number[] = []
    for (let c = 0; c < dataCount; c++) {
      // Cauchy: 1 / (x_r XOR y_c), where x_r = dataCount + r, y_c = c
      const xi = dataCount + r
      const yj = c
      row.push(gfInverse(xi ^ yj))
    }
    matrix.push(row)
  }

  return matrix.slice(0, totalRows)
}

/**
 * Encode data shards into parity shards using the encoding matrix.
 * dataShards: array of dataCount Uint8Arrays (all same length).
 * Returns array of parityCount Uint8Arrays.
 */
export function encode(
  dataShards: Uint8Array[],
  parityCount: number,
): Uint8Array[] {
  const dataCount = dataShards.length
  const blockLen = dataShards[0].length
  const matrix = buildEncodingMatrix(dataCount, parityCount)

  const parityShards: Uint8Array[] = []
  for (let p = 0; p < parityCount; p++) {
    const parity = new Uint8Array(blockLen)
    const matrixRow = matrix[dataCount + p]
    for (let c = 0; c < dataCount; c++) {
      const coeff = matrixRow[c]
      for (let i = 0; i < blockLen; i++) {
        parity[i] = gfAdd(parity[i], gfMul(coeff, dataShards[c][i]))
      }
    }
    parityShards.push(parity)
  }

  return parityShards
}

/**
 * Invert a square sub-matrix over GF(2⁸) (Gauss-Jordan elimination).
 * Returns the inverted matrix, or throws if singular.
 */
export function invertMatrix(matrix: number[][]): number[][] {
  const n = matrix.length
  // Augment with identity
  const aug: number[][] = matrix.map((row, i) => {
    const augRow = [...row]
    for (let j = 0; j < n; j++) {
      augRow.push(i === j ? 1 : 0)
    }
    return augRow
  })

  for (let col = 0; col < n; col++) {
    // Find pivot
    let pivotRow = -1
    for (let row = col; row < n; row++) {
      if (aug[row][col] !== 0) {
        pivotRow = row
        break
      }
    }
    if (pivotRow === -1) throw new Error('Singular matrix — cannot invert')

    // Swap
    if (pivotRow !== col) {
      ;[aug[col], aug[pivotRow]] = [aug[pivotRow], aug[col]]
    }

    // Scale pivot row
    const pivotVal = aug[col][col]
    const pivotInv = gfInverse(pivotVal)
    for (let j = 0; j < 2 * n; j++) {
      aug[col][j] = gfMul(aug[col][j], pivotInv)
    }

    // Eliminate column
    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const factor = aug[row][col]
      if (factor === 0) continue
      for (let j = 0; j < 2 * n; j++) {
        aug[row][j] = gfAdd(aug[row][j], gfMul(factor, aug[col][j]))
      }
    }
  }

  // Extract right half
  return aug.map(row => row.slice(n))
}

/**
 * Reconstruct missing shards given surviving shards + encoding matrix.
 * shards: array of totalCount entries, null for missing.
 * Returns fully reconstructed array.
 */
export function reconstruct(
  shards: (Uint8Array | null)[],
  dataCount: number,
  parityCount: number,
): Uint8Array[] {
  const matrix = buildEncodingMatrix(dataCount, parityCount)
  const blockLen = shards.find(s => s !== null)!.length

  // Gather the indices of surviving shards (need at least dataCount)
  const surviving: number[] = []
  for (let i = 0; i < shards.length; i++) {
    if (shards[i] !== null && surviving.length < dataCount) {
      surviving.push(i)
    }
  }
  if (surviving.length < dataCount) {
    throw new Error(
      `Need at least ${dataCount} surviving shards, have ${surviving.length}`,
    )
  }

  // Build sub-matrix from surviving rows
  const subMatrix = surviving.map(i => matrix[i])
  const invMatrix = invertMatrix(subMatrix)

  // Reconstruct data shards
  const reconstructed: Uint8Array[] = []
  for (let d = 0; d < dataCount; d++) {
    const shard = new Uint8Array(blockLen)
    for (let s = 0; s < surviving.length; s++) {
      const coeff = invMatrix[d][s]
      const srcData = shards[surviving[s]]!
      for (let i = 0; i < blockLen; i++) {
        shard[i] = gfAdd(shard[i], gfMul(coeff, srcData[i]))
      }
    }
    reconstructed.push(shard)
  }

  return reconstructed
}
