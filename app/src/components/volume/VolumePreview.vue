<script setup lang="ts">
import { ref, watch } from 'vue'
import { useVolumeStore } from '@/stores/volume'
import { useDiskStore } from '@/stores/disks'
import { useImageStore } from '@/stores/images'
import { byteToRgb } from '@/utils/palette'

const volume = useVolumeStore()
const diskStore = useDiskStore()
const imageStore = useImageStore()

const originalCanvas = ref<HTMLCanvasElement | null>(null)
const onDiskCanvas = ref<HTMLCanvasElement | null>(null)
const reconstructedCanvas = ref<HTMLCanvasElement | null>(null)

const diffStats = ref({ total: 0, matching: 0, missing: 0, corrupted: 0 })

function renderPixelsToCanvas(
  canvas: HTMLCanvasElement | null,
  pixels: Uint8Array | null,
  width: number,
  height: number,
) {
  if (!canvas || !pixels) return
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  const imageData = ctx.createImageData(width, height)
  for (let i = 0; i < width * height; i++) {
    const val = i < pixels.length ? pixels[i] : 0
    const [r, g, b] = byteToRgb(val)
    const off = i * 4
    imageData.data[off] = r
    imageData.data[off + 1] = g
    imageData.data[off + 2] = b
    imageData.data[off + 3] = 255
  }
  ctx.putImageData(imageData, 0, 0)
}

function updatePreviews() {
  if (!volume.populated) return

  // Find the source image (use first image for now — will be refined with distribution tracking)
  const sourceImage = imageStore.images[0]
  if (!sourceImage) return

  const { width, height } = sourceImage
  const totalPixels = width * height

  // Render original
  renderPixelsToCanvas(originalCanvas.value, sourceImage.pixels, width, height)

  // Build "on disk" image: gather pixels from healthy disks, black for failed
  const onDiskPixels = new Uint8Array(totalPixels)
  const reconstructedPixels = new Uint8Array(totalPixels)
  let matching = 0
  let missing = 0

  // Simple reconstruction: just show disk data as-is
  // Full stripe-aware reconstruction will be added with the distribution composable
  for (const disk of diskStore.disks) {
    if (disk.status === 'failed') {
      missing += disk.pixels.length
      continue
    }
    // Pixel data on each disk will be indexed by stripe position later
    // For now, track what we have
  }

  void onDiskPixels
  void reconstructedPixels
  void matching

  diffStats.value = {
    total: totalPixels,
    matching: totalPixels - missing,
    missing,
    corrupted: 0,
  }

  renderPixelsToCanvas(onDiskCanvas.value, onDiskPixels, width, height)
  renderPixelsToCanvas(reconstructedCanvas.value, reconstructedPixels, width, height)
}

watch(
  () => [volume.populated, diskStore.disks.map(d => d.status)],
  updatePreviews,
  { deep: true },
)
</script>

<template>
  <div
    v-if="volume.populated"
    class="rounded-lg border border-border bg-surface-1 p-3"
  >
    <h3 class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
      Volume Preview
    </h3>

    <div class="flex items-start gap-4">
      <!-- Original -->
      <div class="flex flex-col items-center gap-1">
        <canvas
          ref="originalCanvas"
          class="pixel-render w-20 h-20 rounded border border-border bg-surface-0"
        />
        <span class="text-[10px] text-text-muted">Original</span>
      </div>

      <!-- On Disk -->
      <div class="flex flex-col items-center gap-1">
        <canvas
          ref="onDiskCanvas"
          class="pixel-render w-20 h-20 rounded border border-border bg-surface-0"
        />
        <span class="text-[10px] text-text-muted">On Disk</span>
      </div>

      <!-- Reconstructed -->
      <div class="flex flex-col items-center gap-1">
        <canvas
          ref="reconstructedCanvas"
          class="pixel-render w-20 h-20 rounded border border-border bg-surface-0"
        />
        <span class="text-[10px] text-text-muted">Reconstructed</span>
      </div>

      <!-- Stats -->
      <div class="text-xs text-text-secondary space-y-0.5 ml-2">
        <div>Pixels: <span class="font-mono text-text-primary">{{ diffStats.total }}</span></div>
        <div class="text-disk-healthy">
          Match: <span class="font-mono">{{ diffStats.matching }}</span>
        </div>
        <div class="text-disk-failed">
          Missing: <span class="font-mono">{{ diffStats.missing }}</span>
        </div>
        <div class="text-disk-corrupted">
          Corrupted: <span class="font-mono">{{ diffStats.corrupted }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
