import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Algorithm, ChecksumAlgo } from '@/engine/types'

export const useVolumeStore = defineStore('volume', () => {
  const algorithm = ref<Algorithm>('raid5')
  const dataDisks = ref(3)
  const parityDisks = ref(1)
  const blockSize = ref(8)
  const checksumAlgo = ref<ChecksumAlgo>('none')
  const primitivePolynomial = ref(0x11d)
  const animationSpeed = ref(1)
  const autoAnimate = ref(true)

  const totalDisks = computed(() => dataDisks.value + parityDisks.value)
  const stripeWidth = computed(() => dataDisks.value * blockSize.value)

  /** True when image data has been distributed to disks. */
  const populated = ref(false)

  function setAlgorithm(algo: Algorithm) {
    algorithm.value = algo
    // Enforce parity constraints per algorithm
    switch (algo) {
      case 'raid5':
        parityDisks.value = 1
        break
      case 'raid6':
        parityDisks.value = 2
        break
      // reed-solomon keeps user choice
    }
  }

  function $reset() {
    algorithm.value = 'raid5'
    dataDisks.value = 3
    parityDisks.value = 1
    blockSize.value = 8
    checksumAlgo.value = 'none'
    animationSpeed.value = 1
    autoAnimate.value = true
    populated.value = false
  }

  return {
    algorithm,
    dataDisks,
    parityDisks,
    blockSize,
    checksumAlgo,
    primitivePolynomial,
    animationSpeed,
    autoAnimate,
    totalDisks,
    stripeWidth,
    populated,
    setAlgorithm,
    $reset,
  }
})
