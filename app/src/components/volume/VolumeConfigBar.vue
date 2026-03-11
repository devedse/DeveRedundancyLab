<script setup lang="ts">
import { useVolumeStore } from '@/stores/volume'
import { useDiskStore } from '@/stores/disks'
import { watch } from 'vue'
import type { Algorithm, ChecksumAlgo } from '@/engine/types'

const volume = useVolumeStore()
const diskStore = useDiskStore()

// Keep disks in sync with totalDisks count
watch(
  () => volume.totalDisks,
  (count) => {
    if (diskStore.disks.length !== count) {
      diskStore.initDisks(count)
      volume.populated = false
    }
  },
  { immediate: true },
)

function onAlgorithmChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value as Algorithm
  volume.setAlgorithm(value)
}

function onChecksumChange(event: Event) {
  volume.checksumAlgo = (event.target as HTMLSelectElement).value as ChecksumAlgo
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 bg-surface-1 border-b border-border">
    <!-- Algorithm -->
    <label class="config-field">
      <span class="config-label">Algorithm</span>
      <select
        :value="volume.algorithm"
        class="config-select"
        @change="onAlgorithmChange"
      >
        <option value="raid5">RAID 5</option>
        <option value="raid6">RAID 6</option>
        <option value="reed-solomon">Reed-Solomon</option>
      </select>
    </label>

    <!-- Data Disks -->
    <label class="config-field">
      <span class="config-label">Data Disks</span>
      <input
        v-model.number="volume.dataDisks"
        type="number"
        :min="2"
        :max="16"
        class="config-input w-16"
      />
    </label>

    <!-- Parity Disks -->
    <label class="config-field">
      <span class="config-label">Parity Disks</span>
      <input
        v-model.number="volume.parityDisks"
        type="number"
        :min="1"
        :max="4"
        :disabled="volume.algorithm !== 'reed-solomon'"
        class="config-input w-16"
      />
    </label>

    <!-- Block Size -->
    <label class="config-field">
      <span class="config-label">Block Size</span>
      <select v-model.number="volume.blockSize" class="config-select">
        <option :value="4">4 px</option>
        <option :value="8">8 px</option>
        <option :value="16">16 px</option>
        <option :value="32">32 px</option>
      </select>
    </label>

    <!-- Checksum -->
    <label class="config-field">
      <span class="config-label">Checksum</span>
      <select
        :value="volume.checksumAlgo"
        class="config-select"
        @change="onChecksumChange"
      >
        <option value="none">None</option>
        <option value="xor8">XOR-8</option>
        <option value="crc8">CRC-8</option>
        <option value="crc32">CRC-32</option>
      </select>
    </label>

    <!-- Spacer -->
    <div class="flex-1" />

    <!-- Animation Speed -->
    <label class="config-field">
      <span class="config-label">Speed</span>
      <input
        v-model.number="volume.animationSpeed"
        type="range"
        min="0.25"
        max="4"
        step="0.25"
        class="w-20 accent-accent"
      />
      <span class="text-xs font-mono text-text-muted w-8 text-right">
        {{ volume.animationSpeed }}×
      </span>
    </label>

    <!-- Auto-animate toggle -->
    <label class="config-field cursor-pointer">
      <span class="config-label">Auto</span>
      <input
        v-model="volume.autoAnimate"
        type="checkbox"
        class="accent-accent"
      />
    </label>
  </div>
</template>

<style scoped>
@reference "../../style.css";
.config-field {
  @apply flex items-center gap-1.5;
}
.config-label {
  @apply text-xs text-text-secondary whitespace-nowrap;
}
.config-select {
  @apply rounded bg-surface-2 border border-border text-sm text-text-primary
         px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent;
}
.config-input {
  @apply rounded bg-surface-2 border border-border text-sm text-text-primary
         px-2 py-1 text-center focus:outline-none focus:ring-1 focus:ring-accent
         disabled:opacity-40;
}
</style>
