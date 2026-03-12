import { defineStore } from 'pinia'
import { ref } from 'vue'
import { rgbToByte } from '@/utils/palette'

export interface ImageAsset {
  id: string
  name: string
  width: number
  height: number
  pixels: Uint8Array
  thumbnail: string
}

/** Create a built-in smiley face image (8×8). */
function createSmiley(): ImageAsset {
  // 8×8 smiley: yellow face, black eyes, black mouth
  const W = 0b11111100 // bright yellow  (R=7,G=7,B=0) = 0xFC
  const B = 0b00000000 // black
  const O = 0b11100000 // red (outline)
  //prettier-ignore
  const raw = [
    B, B, W, W, W, W, B, B,
    B, W, W, W, W, W, W, B,
    W, W, B, W, W, B, W, W,
    W, W, W, W, W, W, W, W,
    W, W, W, W, W, W, W, W,
    W, B, W, W, W, W, B, W,
    B, W, B, B, B, B, W, B,
    B, B, W, W, W, W, B, B,
  ]
  // Replace O references that got forgotten
  void O
  const pixels = new Uint8Array(raw)
  return {
    id: 'smiley-8x8',
    name: 'Smiley 8×8',
    width: 8,
    height: 8,
    pixels,
    thumbnail: '',
  }
}

/** Create a gradient test pattern (8×8). */
function createGradient(): ImageAsset {
  const pixels = new Uint8Array(64)
  for (let i = 0; i < 64; i++) {
    pixels[i] = (i * 4) & 0xff
  }
  return {
    id: 'gradient-8x8',
    name: 'Gradient 8×8',
    width: 8,
    height: 8,
    pixels,
    thumbnail: '',
  }
}

/** Create a checker pattern (8×8). */
function createChecker(): ImageAsset {
  const pixels = new Uint8Array(64)
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      pixels[y * 8 + x] = (x + y) % 2 === 0 ? 0xff : 0x00
    }
  }
  return {
    id: 'checker-8x8',
    name: 'Checker 8×8',
    width: 8,
    height: 8,
    pixels,
    thumbnail: '',
  }
}

/** Create a Mickey Mouse face (8×8). */
function createMickey(): ImageAsset {
  const _ = 0b01010111 // sky-blue background (R=72,G=180,B=255)
  const B = 0b00000000 // black (ears, outline, nose)
  const S = 0b11010101 // warm peach skin (R=216,G=180,B=85)
  const W = 0b11111111 // white (eyes)
  //prettier-ignore
  const raw = [
    _, B, B, _, _, B, B, _,  // ears top
    B, B, B, _, _, B, B, B,  // ears bottom
    _, _, B, B, B, B, _, _,  // head top outline
    _, B, S, S, S, S, B, _,  // forehead
    _, B, W, S, S, W, B, _,  // eyes
    _, B, S, B, B, S, B, _,  // nose
    _, _, B, S, S, B, _, _,  // lower face
    _, _, _, B, B, _, _, _,  // chin
  ]
  const pixels = new Uint8Array(raw)
  return {
    id: 'mickey-8x8',
    name: 'Mickey 8×8',
    width: 8,
    height: 8,
    pixels,
    thumbnail: '',
  }
}

export const useImageStore = defineStore('images', () => {
  const images = ref<ImageAsset[]>([createSmiley(), createGradient(), createChecker(), createMickey()])

  const selectedImageId = ref<string | null>(null)

  function addImage(asset: ImageAsset) {
    images.value.push(asset)
  }

  /**
   * Import from an HTMLImageElement: draw to canvas, read pixels,
   * quantize to 8-bit palette.
   */
  function importFromImage(
    img: HTMLImageElement,
    name: string,
    targetSize: number = 8,
  ): ImageAsset {
    const canvas = document.createElement('canvas')
    canvas.width = targetSize
    canvas.height = targetSize
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(img, 0, 0, targetSize, targetSize)
    const imageData = ctx.getImageData(0, 0, targetSize, targetSize)
    const pixels = new Uint8Array(targetSize * targetSize)
    for (let i = 0; i < pixels.length; i++) {
      const offset = i * 4
      pixels[i] = rgbToByte(
        imageData.data[offset],
        imageData.data[offset + 1],
        imageData.data[offset + 2],
      )
    }
    const asset: ImageAsset = {
      id: `user-${Date.now()}`,
      name,
      width: targetSize,
      height: targetSize,
      pixels,
      thumbnail: canvas.toDataURL(),
    }
    addImage(asset)
    return asset
  }

  return {
    images,
    selectedImageId,
    addImage,
    importFromImage,
  }
})
