<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { byteToRgb } from '@/utils/palette'
import type { DiskStatus } from '@/engine/types'

const props = defineProps<{
  pixels: Uint8Array
  blockSize: number
  status: DiskStatus
  corruptedPixels?: Set<number>
  rebuildProgress?: number
  parityPRows?: Set<number>
  parityQRows?: Set<number>
  writeStripe?: number
  writePhase?: string | null
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

    // Parity block tinting
    if (props.parityPRows?.has(row)) {
      ctx.fillStyle = 'rgba(251, 191, 36, 0.22)'
      ctx.fillRect(col * PIXEL_SIZE, row * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE)
      // "P" label on first pixel of each parity row
      if (col === 0) {
        ctx.fillStyle = 'rgba(251, 191, 36, 0.75)'
        ctx.font = 'bold 8px monospace'
        ctx.fillText('P', col * PIXEL_SIZE + 2, row * PIXEL_SIZE + PIXEL_SIZE - 3)
      }
    }
    if (props.parityQRows?.has(row)) {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.22)'
      ctx.fillRect(col * PIXEL_SIZE, row * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE)
      if (col === 0) {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.75)'
        ctx.font = 'bold 8px monospace'
        ctx.fillText('Q', col * PIXEL_SIZE + 2, row * PIXEL_SIZE + PIXEL_SIZE - 3)
      }
    }

    // Corrupted pixel indicator
    if (props.corruptedPixels?.has(i)) {
      ctx.fillStyle = 'rgba(167, 139, 250, 0.5)'
      ctx.fillRect(col * PIXEL_SIZE, row * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE)
      const cx = col * PIXEL_SIZE + PIXEL_SIZE / 2
      const cy = row * PIXEL_SIZE + PIXEL_SIZE / 2
      ctx.fillStyle = 'rgba(167, 139, 250, 0.9)'
      ctx.beginPath()
      ctx.moveTo(cx, cy - 3)
      ctx.lineTo(cx + 3, cy)
      ctx.lineTo(cx, cy + 3)
      ctx.lineTo(cx - 3, cy)
      ctx.closePath()
      ctx.fill()
    }
  }

  // Write animation highlight on the active stripe row
  if (props.writeStripe != null && props.writeStripe >= 0 && props.writeStripe < rows) {
    const y = props.writeStripe * PIXEL_SIZE
    const isParity = props.writePhase === 'parity'
    // Glow fill
    ctx.fillStyle = isParity
      ? 'rgba(251, 191, 36, 0.35)'
      : 'rgba(74, 222, 128, 0.25)'
    ctx.fillRect(0, y, canvas.width, PIXEL_SIZE)
    // Bright border around active row
    ctx.strokeStyle = isParity
      ? 'rgba(251, 191, 36, 0.9)'
      : 'rgba(74, 222, 128, 0.9)'
    ctx.lineWidth = 2
    ctx.strokeRect(1, y + 1, canvas.width - 2, PIXEL_SIZE - 2)
  }

  // Overlay for failed/corrupted states
  if (props.status === 'failed') {
    ctx.fillStyle = 'rgba(248, 113, 113, 0.35)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
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
    const progress = props.rebuildProgress ?? 0
    const revealY = progress * canvas.height
    if (revealY > 0) {
      ctx.fillStyle = 'rgba(74, 222, 128, 0.12)'
      ctx.fillRect(0, 0, canvas.width, revealY)
    }
    if (revealY < canvas.height) {
      ctx.fillStyle = 'rgba(96, 165, 250, 0.25)'
      ctx.fillRect(0, revealY, canvas.width, canvas.height - revealY)
    }
    if (progress > 0 && progress < 1) {
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.8)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(0, revealY)
      ctx.lineTo(canvas.width, revealY)
      ctx.stroke()
    }
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
watch(
  () => [props.pixels, props.status, props.rebuildProgress, props.writeStripe, props.writePhase],
  render,
  { deep: true },
)
</script>

<template>
  <canvas
    ref="canvasRef"
    class="pixel-render w-full h-auto rounded cursor-crosshair"
    @mousemove="onMouseMove"
    @click="onClick"
  />
</template>
