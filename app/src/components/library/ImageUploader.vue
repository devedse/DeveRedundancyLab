<script setup lang="ts">
import { ref } from 'vue'
import { useImageStore } from '@/stores/images'

const imageStore = useImageStore()
const fileInput = ref<HTMLInputElement | null>(null)

function openFilePicker() {
  fileInput.value?.click()
}

function handleFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const img = new Image()
  img.onload = () => {
    imageStore.importFromImage(img, file.name.replace(/\.[^.]+$/, ''), 8)
    URL.revokeObjectURL(img.src)
  }
  img.src = URL.createObjectURL(file)
  input.value = ''
}
</script>

<template>
  <button
    class="w-full rounded-md border border-dashed border-border py-2 text-xs text-text-muted
           hover:border-accent hover:text-text-secondary transition-colors"
    @click="openFilePicker"
  >
    + Upload Image
  </button>
  <input
    ref="fileInput"
    type="file"
    accept="image/*"
    class="hidden"
    @change="handleFile"
  />
</template>
