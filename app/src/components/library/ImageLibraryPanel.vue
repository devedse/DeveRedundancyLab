<script setup lang="ts">
import { useImageStore } from '@/stores/images'
import ImageCard from './ImageCard.vue'
import ImageUploader from './ImageUploader.vue'

const imageStore = useImageStore()
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="px-3 py-2 border-b border-border">
      <h2 class="text-sm font-semibold text-text-secondary uppercase tracking-wider">
        Image Library
      </h2>
    </div>

    <div class="flex-1 overflow-y-auto p-2 space-y-2">
      <ImageCard
        v-for="image in imageStore.images"
        :key="image.id"
        :image="image"
      />
    </div>

    <div class="p-2 border-t border-border">
      <ImageUploader />
    </div>
  </div>
</template>
