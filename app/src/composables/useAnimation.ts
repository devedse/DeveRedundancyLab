/**
 * GSAP-powered animations for disk rebuild and distribution.
 */
import { reactive } from 'vue'
import gsap from 'gsap'
import { useDiskStore } from '@/stores/disks'
import type { useVolumeStore } from '@/stores/volume'
import type { DistributionPlan } from './useDistribution'

type VolumeStore = ReturnType<typeof useVolumeStore>
type DiskStore = ReturnType<typeof useDiskStore>

/** Distribution animation state (reactive so components can track it). */
export const distributionState = reactive({
  active: false,
  currentStripe: -1,
  phase: 'idle' as 'idle' | 'data' | 'parity',
})

/** Per-disk rebuild progress (0 → 1). Reactive Map so Vue tracks .get() calls. */
const rebuildProgress = reactive(new Map<number, number>())

/** Get the current rebuild progress for a disk (0 if not animating). */
export function getRebuildProgress(diskId: number): number {
  return rebuildProgress.get(diskId) ?? 0
}

/**
 * Animate a disk rebuild reveal: sweeps from top to bottom over `duration` seconds,
 * then calls finishRebuild to transition to healthy.
 */
export function animateRebuild(diskId: number, duration = 1.5): Promise<void> {
  const diskStore = useDiskStore()
  rebuildProgress.set(diskId, 0)

  return new Promise((resolve) => {
    const proxy = { value: 0 }
    gsap.to(proxy, {
      value: 1,
      duration,
      ease: 'power2.out',
      onUpdate() {
        rebuildProgress.set(diskId, proxy.value)
      },
      onComplete() {
        rebuildProgress.delete(diskId)
        diskStore.finishRebuild(diskId)
        resolve()
      },
    })
  })
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Animate distributing an image to disks, stripe by stripe.
 * Phase 1 of each stripe writes data blocks, phase 2 computes & writes parity.
 */
export async function animateDistribution(
  plan: DistributionPlan,
  diskStore: DiskStore,
  volume: VolumeStore,
  imageId: string,
  speed: number = 1,
): Promise<void> {
  const baseDelay = 350 // ms per stripe phase at 1x

  // Initialize empty disks
  diskStore.initDisks(plan.totalDisks)
  for (let d = 0; d < plan.totalDisks; d++) {
    diskStore.disks[d].pixels = new Uint8Array(plan.totalBytesPerDisk)
  }

  // Mark populated early so the disk columns become visible
  volume.sourceImageId = imageId
  volume.populated = true

  distributionState.active = true

  for (let s = 0; s < plan.stripeCount; s++) {
    distributionState.currentStripe = s
    const ops = plan.stripeWrites[s]
    const dataOps = ops.filter(op => op.role === 'data')
    const parityOps = ops.filter(op => op.role !== 'data')

    // Phase 1: write data blocks
    distributionState.phase = 'data'
    const dataAffected = new Set<number>()
    for (const op of dataOps) {
      diskStore.disks[op.diskId].pixels.set(op.data, op.offset)
      dataAffected.add(op.diskId)
    }
    // Trigger Vue reactivity by replacing the typed-array reference
    for (const dId of dataAffected) {
      diskStore.disks[dId].pixels = diskStore.disks[dId].pixels.slice()
    }

    await wait(baseDelay / speed)

    // Phase 2: compute & write parity
    if (parityOps.length > 0) {
      distributionState.phase = 'parity'
      const parityAffected = new Set<number>()
      for (const op of parityOps) {
        diskStore.disks[op.diskId].pixels.set(op.data, op.offset)
        parityAffected.add(op.diskId)
      }
      for (const dId of parityAffected) {
        diskStore.disks[dId].pixels = diskStore.disks[dId].pixels.slice()
      }

      await wait((baseDelay * 0.6) / speed)
    }
  }

  // Finalize
  distributionState.active = false
  distributionState.currentStripe = -1
  distributionState.phase = 'idle'

  for (const disk of diskStore.disks) {
    disk.status = 'healthy'
  }
}
