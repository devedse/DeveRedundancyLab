<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { byteToRgb } from '@/utils/palette'
import type { DiskStatus } from '@/engine/types'

const props = defineProps<{
  pixels: Uint8Array
  blockSize: number
  status: DiskStatus
}>()

const emit = defineEmits<{
  pixelHover: [index: number]
  pixelClick: [index: number]
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const PIXEL_SIZE = 12 // Screen pixels per data pixel

function render() {
  const canvas = canvasRef.value
  if (!canvas || props.pixels.length === 0) return

  const cols = props.blockSize
  const rows = Math.ceil(props.pixels.length / cols)

  canvas.width = cols * PIXEL_SIZE
  canvas.height = rows * PIXEL_SIZE

  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  for (let i = 0; i < props.pixels.length; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const [r, g, b] = byteToRgb(props.pixels[i])

    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
    ctx.fillRect(col * PIXEL_SIZE, row * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE)

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.strokeRect(col * PIXEL_SIZE, row * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE)
  }

  // Overlay for failed/corrupted states
  if (props.status === 'failed') {
    ctx.fillStyle = 'rgba(248, 113, 113, 0.35)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    // Draw X
    ctx.strokeStyle = 'rgba(248, 113, 113, 0.6)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(canvas.width, canvas.height)
    ctx.moveTo(canvas.width, 0)
    ctx.lineTo(0, canvas.height)
    ctx.stroke()
  }

  if (props.status === 'rebuilding') {
    ctx.fillStyle = 'rgba(96, 165, 250, 0.2)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
}

function getPixelIndex(event: MouseEvent): number {
  const canvas = canvasRef.value
  if (!canvas) return -1
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  const x = (event.clientX - rect.left) * scaleX
  const y = (event.clientY - rect.top) * scaleY
  const col = Math.floor(x / PIXEL_SIZE)
  const row = Math.floor(y / PIXEL_SIZE)
  const idx = row * props.blockSize + col
  return idx < props.pixels.length ? idx : -1
}

function onMouseMove(event: MouseEvent) {
  const idx = getPixelIndex(event)
  if (idx >= 0) emit('pixelHover', idx)
}

function onClick(event: MouseEvent) {
  const idx = getPixelIndex(event)
  if (idx >= 0) emit('pixelClick', idx)
}

onMounted(render)
watch(() => [props.pixels, props.status], render, { deep: true })
</script>

<template>
  <canvas
    ref="canvasRef"
    class="pixel-render w-full rounded cursor-crosshair"
    @mousemove="onMouseMove"
    @click="onClick"
  />
</template>
