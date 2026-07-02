<script setup lang="ts">
import type { Item } from '#shared/types/api'

const props = withDefaults(defineProps<{
  modelValue: string
  allowedInstanceIds?: number[]
  required?: boolean
  // when set, the picked instance is remembered in localStorage under this key
  persistKey?: string
}>(), {
  allowedInstanceIds: () => [],
  required: true,
  persistKey: ''
})
const emit = defineEmits<{
  'update:modelValue': [value: string]
  'select': [item: Item]
}>()

const catalog = useCatalogStore()
// instances are shared (cached once); items + loading are LOCAL to this picker
// so two pickers (auction + prebid forms) don't thrash a shared list/spinner.
const { instances } = storeToRefs(catalog)
const items = ref<Item[]>([])
const loading = ref(false)
const instanceID = ref(0)
const ready = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

const allowedSet = computed(() => new Set(props.allowedInstanceIds))
const visibleInstances = computed(() => {
  if (!props.allowedInstanceIds.length) return instances.value
  return instances.value.filter(instance => allowedSet.value.has(instance.id))
})
// only worth picking when the session spans more than one instance
const showInstancePicker = computed(() => visibleInstances.value.length > 1)
const canSearchItems = computed(() => !showInstancePicker.value || instanceID.value > 0)

async function searchItems() {
  if (!canSearchItems.value) {
    items.value = []
    loading.value = false
    return
  }
  loading.value = true
  try {
    const { request } = useApi()
    const q = new URLSearchParams()
    if (instanceID.value) q.set('instance_id', String(instanceID.value))
    if (props.modelValue.trim()) q.set('search', props.modelValue.trim())
    q.set('limit', '60')
    items.value = await request<Item[]>(`/api/v1/internal/items?${q.toString()}`) ?? []
  } catch {
    items.value = []
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await catalog.loadInstances()
  syncInstanceSelection()
  ready.value = true // search exactly once, after the instance is settled
  if (canSearchItems.value) {
    await searchItems()
  }
})

// the item-name field doubles as the search box
watch([instanceID, () => props.modelValue], () => {
  if (!ready.value) return
  if (timer) clearTimeout(timer)
  timer = setTimeout(searchItems, 250)
})

watch(() => props.allowedInstanceIds, () => {
  syncInstanceSelection()
}, { deep: true })

function storageKey() {
  return `cb_picker_instance_${props.persistKey}`
}
function restoreInstance() {
  if (!import.meta.client || !props.persistKey) return 0
  const raw = Number(localStorage.getItem(storageKey()) || 0)
  return Number.isFinite(raw) ? raw : 0
}

function syncInstanceSelection() {
  if (!visibleInstances.value.length) {
    instanceID.value = 0
    return
  }
  if (visibleInstances.value.length === 1) {
    instanceID.value = visibleInstances.value[0]?.id ?? 0
    return
  }
  // >1 instances: keep a valid current pick, else restore the last-used one,
  // else default to the first so the picker is never left empty
  if (visibleInstances.value.some(instance => instance.id === instanceID.value)) return
  const stored = restoreInstance()
  instanceID.value = visibleInstances.value.some(instance => instance.id === stored)
    ? stored
    : visibleInstances.value[0]?.id ?? 0
}

function selectItem(item: Item) {
  emit('update:modelValue', item.name)
  emit('select', item)
}

function selectInstance(id: number) {
  if (instanceID.value === id) return
  instanceID.value = id
  if (import.meta.client && props.persistKey) {
    localStorage.setItem(storageKey(), String(id))
  }
  emit('update:modelValue', '')
  items.value = []
}

function iconUrl(item: Item) {
  return item.icon_url || `/api/v1/images?path=files/icons/${item.wow_item_id}.jpg`
}

function onIconError(e: globalThis.Event) {
  (e.target as HTMLImageElement).style.visibility = 'hidden'
}
</script>

<template>
  <div class="item-picker">
    <UFormField
      label="Item Name"
      :required="required"
    >
      <UInput
        :model-value="modelValue"
        class="w-full"
        icon="i-lucide-search"
        placeholder="Search or type item name"
        @update:model-value="emit('update:modelValue', String($event))"
      />
    </UFormField>

    <div
      v-if="showInstancePicker"
      class="session-instance-picker"
    >
      <button
        v-for="instance in visibleInstances"
        :key="instance.id"
        type="button"
        class="session-instance-choice"
        :class="{ 'is-selected': instanceID === instance.id }"
        @click="selectInstance(instance.id)"
      >
        <span>{{ instance.name }}</span>
        <small>{{ instance.expansion }}</small>
      </button>
    </div>

    <div
      v-if="!canSearchItems"
      class="py-4 text-center opacity-70"
    >
      Choose an instance to show items.
    </div>
    <div
      v-else-if="loading"
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
        @click="selectItem(item)"
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
