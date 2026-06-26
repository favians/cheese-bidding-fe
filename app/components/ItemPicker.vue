<script setup lang="ts">
import type { Item } from '#shared/types/api'

const props = withDefaults(defineProps<{
  allowedInstanceIds?: number[]
}>(), {
  allowedInstanceIds: () => []
})
const emit = defineEmits<{ select: [item: Item] }>()

const catalog = useCatalogStore()
const { instances, items, loading } = storeToRefs(catalog)
const instanceID = ref(0)
const search = ref('')
let timer: ReturnType<typeof setTimeout> | undefined

const allowedSet = computed(() => new Set(props.allowedInstanceIds))
const visibleInstances = computed(() => {
  if (!props.allowedInstanceIds.length) return instances.value
  return instances.value.filter(instance => allowedSet.value.has(instance.id))
})

const instanceOptions = computed(() => {
  if (props.allowedInstanceIds.length) {
    return visibleInstances.value.map(i => ({ label: i.name, value: i.id }))
  }
  return [
    { label: 'All instances', value: 0 },
    ...instances.value.map(i => ({ label: i.name, value: i.id }))
  ]
})

onMounted(() => {
  catalog.loadInstances().then(() => syncInstanceSelection())
  catalog.searchItems(instanceID.value, '')
})

watch([instanceID, search], () => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => catalog.searchItems(instanceID.value, search.value), 250)
})

watch(() => props.allowedInstanceIds, () => {
  syncInstanceSelection()
}, { deep: true })

function syncInstanceSelection() {
  if (!props.allowedInstanceIds.length) return
  if (!props.allowedInstanceIds.includes(instanceID.value)) {
    instanceID.value = props.allowedInstanceIds[0] ?? 0
  }
}

function iconUrl(item: Item) {
  return item.icon_path ? `/${item.icon_path}` : `/icons/${item.wow_item_id}.jpg`
}

function onIconError(e: globalThis.Event) {
  (e.target as HTMLImageElement).style.visibility = 'hidden'
}
</script>

<template>
  <div>
    <div class="mb-3 flex gap-2">
      <USelect
        v-model="instanceID"
        :items="instanceOptions"
        class="w-44"
        :disabled="props.allowedInstanceIds.length > 0 && !instanceOptions.length"
      />
      <UInput
        v-model="search"
        placeholder="Search item…"
        icon="i-lucide-search"
        class="flex-1"
      />
    </div>
    <div
      v-if="loading"
      class="py-6 text-center opacity-70"
    >
      Searching…
    </div>
    <div
      v-else-if="!items.length"
      class="py-6 text-center opacity-70"
    >
      No items found.
    </div>
    <div
      v-else
      class="grid max-h-80 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2"
    >
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white/10"
        @click="emit('select', item)"
      >
        <img
          :src="iconUrl(item)"
          class="h-8 w-8 shrink-0 rounded"
          loading="lazy"
          @error="onIconError"
        >
        <span class="min-w-0">
          <span class="block truncate text-sm">{{ item.name }}</span>
          <span class="block truncate text-xs opacity-60">{{ item.boss_name }} · {{ item.instance_name }}</span>
        </span>
      </button>
    </div>
  </div>
</template>
