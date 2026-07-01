import type { Instance, Item, WowClassDefinition } from '#shared/types/api'
import { wowClasses } from '~/data/wowClasses'

export const useCatalogStore = defineStore('catalog', () => {
  const instances = ref<Instance[]>([])
  const items = ref<Item[]>([])
  const classes = ref<WowClassDefinition[]>([])
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

  async function loadClasses(scope: 'internal' | 'client' = 'internal') {
    if (classes.value.length) return
    const { request } = useApi()
    const prefix = scope === 'client' ? '/api/v1/client' : '/api/v1/internal'
    try {
      const rows = await request<WowClassDefinition[]>(`${prefix}/classes`)
      classes.value = rows.map(row => ({
        ...row,
        icon: row.icon || row.icon_path || `/icons/classes/${row.slug}.png`
      }))
    } catch {
      classes.value = wowClasses
    }
  }

  return { instances, items, classes, loading, loadInstances, loadClasses, searchItems }
})
