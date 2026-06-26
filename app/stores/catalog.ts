import type { Instance, Item } from '#shared/types/api'

export const useCatalogStore = defineStore('catalog', () => {
  const instances = ref<Instance[]>([])
  const items = ref<Item[]>([])
  const loading = ref(false)

  async function loadInstances() {
    if (instances.value.length) return
    const { request } = useApi()
    try {
      instances.value = await request<Instance[]>('/api/v1/internal/instances')
    } catch {
      instances.value = []
    }
  }

  async function searchItems(instanceID: number, search: string) {
    const { request } = useApi()
    loading.value = true
    try {
      const q = new URLSearchParams()
      if (instanceID) q.set('instance_id', String(instanceID))
      if (search.trim()) q.set('search', search.trim())
      q.set('limit', '60')
      items.value = await request<Item[]>(`/api/v1/internal/items?${q.toString()}`)
    } catch {
      items.value = []
    } finally {
      loading.value = false
    }
  }

  return { instances, items, loading, loadInstances, searchItems }
})
