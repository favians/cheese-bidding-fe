<script setup lang="ts">
import type { Pagination } from '#shared/types/api'

const props = defineProps<{
  pagination: Pagination | null
  loading?: boolean
}>()

const emit = defineEmits<{
  change: [page: number]
}>()

const currentPage = computed(() => {
  if (!props.pagination) return 1
  return Math.min(props.pagination.page, Math.max(props.pagination.page_total, 1))
})

function goToPage(page: number) {
  if (!props.pagination) return
  const lastPage = Math.max(props.pagination.page_total, 1)
  emit('change', Math.min(Math.max(page, 1), lastPage))
}
</script>

<template>
  <div
    v-if="pagination && pagination.page_total > 1"
    class="admin-pagination"
  >
    <UButton
      size="lg"
      color="neutral"
      variant="soft"
      icon="i-lucide-chevron-left"
      class="admin-pagination-button"
      :disabled="!pagination.prev_page || loading"
      aria-label="Previous page"
      @click="goToPage(currentPage - 1)"
    />
    <span class="admin-pagination-label">
      {{ currentPage }} / {{ pagination.page_total }}
    </span>
    <UButton
      size="lg"
      color="neutral"
      variant="soft"
      icon="i-lucide-chevron-right"
      class="admin-pagination-button"
      :disabled="!pagination.next_page || loading"
      aria-label="Next page"
      @click="goToPage(currentPage + 1)"
    />
  </div>
</template>
