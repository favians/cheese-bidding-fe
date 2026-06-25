<script setup lang="ts">
useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ],
  htmlAttrs: {
    lang: 'en'
  },
  bodyAttrs: {
    'data-route': 'public'
  }
})

useSeoMeta({
  title: 'CheeseBidding V2',
  description: 'Real-time loot bidding for Cheese GDKP.'
})
</script>

<template>
  <UApp>
    <NuxtPage />
  </UApp>
</template>
