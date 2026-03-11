<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { ImageAsset } from '@/stores/images'
import { byteToRgb } from '@/utils/palette'

const props = defineProps<{ image: ImageAsset }>()

const canvasRef = ref<HTMLCanvasElement | null>(null)

function renderThumbnail() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')!
  const { width, height, pixels } = props.image
  canvas.width = width
  canvas.height = height
  const imageData = ctx.createImageData(width, height)
  for (let i = 0; i < pixels.length; i++) {
    const [r, g, b] = byteToRgb(pixels[i])
    const offset = i * 4
    imageData.data[offset] = r
    imageData.data[offset + 1] = g
    imageData.data[offset + 2] = b
    imageData.data[offset + 3] = 255
  }
  ctx.putImageData(imageData, 0, 0)
}

onMounted(renderThumbnail)

function onDragStart(event: DragEvent) {
  event.dataTransfer?.setData('application/x-image-id', props.image.id)
  event.dataTransfer!.effectAllowed = 'copy'
}
</script>

<template>
  <div
    class="group relative rounded-lg border border-border bg-surface-2 p-2 cursor-grab
           hover:border-accent hover:bg-surface-3 transition-colors"
    draggable="true"
    @dragstart="onDragStart"
  >
    <canvas
      ref="canvasRef"
      class="pixel-render w-full aspect-square rounded bg-surface-0"
    />
    <div class="mt-1.5 flex items-center justify-between">
      <span class="text-xs text-text-secondary truncate">{{ image.name }}</span>
      <span class="text-[10px] font-mono text-text-muted">
        {{ image.width }}×{{ image.height }}
      </span>
    </div>
  </div>
</template>
