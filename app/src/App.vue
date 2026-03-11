<script setup lang="ts">
import AppHeader from '@/components/layout/AppHeader.vue'
import MainLayout from '@/components/layout/MainLayout.vue'
import StatusBar from '@/components/layout/StatusBar.vue'
</script>

<template>
  <div class="flex flex-col h-screen overflow-hidden">
    <AppHeader />
    <MainLayout class="flex-1 min-h-0" />
    <StatusBar />
  </div>
</template>
