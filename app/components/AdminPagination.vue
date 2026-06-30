<script setup lang="ts">
import type { Pagination } from '#shared/types/api'

defineProps<{
  pagination: Pagination | null
  loading?: boolean
}>()

const emit = defineEmits<{
  change: [page: number]
}>()
</script>

<template>
  <div
    v-if="pagination && pagination.page_total > 1"
    class="admin-pagination"
  >
    <UButton
      size="xs"
      color="neutral"
      variant="soft"
      icon="i-lucide-chevron-left"
      :disabled="!pagination.prev_page || loading"
      aria-label="Previous page"
      @click="emit('change', pagination.page - 1)"
    />
    <span class="admin-pagination-label">
      {{ pagination.page }} / {{ pagination.page_total }}
    </span>
    <UButton
      size="xs"
      color="neutral"
      variant="soft"
      icon="i-lucide-chevron-right"
      :disabled="!pagination.next_page || loading"
      aria-label="Next page"
      @click="emit('change', pagination.page + 1)"
    />
  </div>
</template>
