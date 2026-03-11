<script setup lang="ts">
import { ref } from 'vue'
import { useVolumeStore } from '@/stores/volume'
import GaloisFieldExplorer from '@/components/galois/GaloisFieldExplorer.vue'

const volume = useVolumeStore()
const gfOpen = ref(false)
</script>

<template>
  <header class="flex items-center justify-between px-4 py-2 bg-surface-1 border-b border-border">
    <div class="flex items-center gap-3">
      <h1 class="text-lg font-semibold tracking-tight text-text-primary">
        Deve Disk Recovery Simulator
      </h1>
      <span class="rounded bg-surface-3 px-2 py-0.5 text-xs font-mono text-text-secondary uppercase">
        {{ volume.algorithm }}
      </span>
    </div>

    <div class="flex items-center gap-2">
      <button
        class="rounded-md bg-surface-2 px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-3 hover:text-text-primary transition-colors"
        title="Open GF(2⁸) Explorer"
        @click="gfOpen = true"
      >
        🔬 GF Explorer
      </button>
      <button
        class="rounded-md bg-surface-2 px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-3 hover:text-text-primary transition-colors"
        title="Help"
      >
        ?
      </button>
    </div>
  </header>

  <GaloisFieldExplorer :open="gfOpen" @close="gfOpen = false" />
</template>
