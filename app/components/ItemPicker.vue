<script setup lang="ts">
import type { Item } from '#shared/types/api'

const props = withDefaults(defineProps<{
  allowedInstanceIds?: number[]
}>(), {
  allowedInstanceIds: () => []
})
const emit = defineEmits<{ select: [item: Item] }>()

const catalog = useCatalogStore()
// instances are shared (cached once); items + loading are LOCAL to this picker
// so two pickers (auction + prebid forms) don't thrash a shared list/spinner.
const { instances } = storeToRefs(catalog)
const items = ref<Item[]>([])
const loading = ref(false)
const instanceID = ref(0)
const search = ref('')
const ready = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

async function searchItems() {
  loading.value = true
  try {
    const { request } = useApi()
    const q = new URLSearchParams()
    if (instanceID.value) q.set('instance_id', String(instanceID.value))
    if (search.value.trim()) q.set('search', search.value.trim())
    q.set('limit', '60')
    items.value = await request<Item[]>(`/api/v1/internal/items?${q.toString()}`) ?? []
  } catch {
    items.value = []
  } finally {
    loading.value = false
  }
}

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

onMounted(async () => {
  await catalog.loadInstances()
  syncInstanceSelection()
  ready.value = true // search exactly once, after the instance is settled
  await searchItems()
})

watch([instanceID, search], () => {
  if (!ready.value) return
  if (timer) clearTimeout(timer)
  timer = setTimeout(searchItems, 250)
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
  return item.icon_url || `/api/v1/images?path=files/icons/${item.wow_item_id}.jpg`
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
