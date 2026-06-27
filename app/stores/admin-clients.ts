import type { ClientAdmin, AdminCreateClientRequest } from '#shared/types/api'

export const useAdminClientsStore = defineStore('admin-clients', () => {
  const clients = ref<ClientAdmin[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const error = ref('')
  // the plaintext shown once after a create/reset (admin shares it with the player)
  const lastPassword = ref<{ username: string, password: string } | null>(null)

  async function load(search = '') {
    const { request } = useApi()
    loading.value = true
    error.value = ''
    try {
      const q = new URLSearchParams({ limit: '100' })
      if (search.trim()) q.set('search', search.trim())
      clients.value = await request<ClientAdmin[]>(`/api/v1/internal/clients?${q.toString()}`)
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Failed to load players'
    } finally {
      loading.value = false
    }
  }

  async function create(payload: AdminCreateClientRequest) {
    const { request } = useApi()
    saving.value = true
    error.value = ''
    try {
      const row = await request<ClientAdmin>('/api/v1/internal/clients', { method: 'POST', body: payload })
      clients.value = [row, ...clients.value]
      lastPassword.value = { username: row.username, password: payload.password }
      return row
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Could not create player'
      throw cause
    } finally {
      saving.value = false
    }
  }

  async function updateDiscord(id: number, discordId: string) {
    const { request } = useApi()
    error.value = ''
    try {
      const row = await request<ClientAdmin>(`/api/v1/internal/clients/${id}`, { method: 'PUT', body: { discord_id: discordId } })
      patch(row)
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Could not update player'
    }
  }

  async function setActive(id: number, isActive: boolean) {
    const { request } = useApi()
    error.value = ''
    try {
      patch(await request<ClientAdmin>(`/api/v1/internal/clients/${id}/active`, { method: 'POST', body: { is_active: isActive } }))
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Could not update player'
    }
  }

  async function setFavorite(id: number, isFavorite: boolean) {
    const { request } = useApi()
    error.value = ''
    try {
      patch(await request<ClientAdmin>(`/api/v1/internal/clients/${id}/favorite`, { method: 'POST', body: { is_favorite: isFavorite } }))
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Could not update player'
    }
  }

  async function resetPassword(id: number) {
    const { request } = useApi()
    error.value = ''
    try {
      const res = await request<{ client: ClientAdmin, password: string }>(`/api/v1/internal/clients/${id}/password-reset`, { method: 'POST' })
      lastPassword.value = { username: res.client.username, password: res.password }
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Could not reset password'
    }
  }

  function patch(row: ClientAdmin) {
    const i = clients.value.findIndex(c => c.id === row.id)
    if (i >= 0) clients.value[i] = row
  }

  return { clients, loading, saving, error, lastPassword, load, create, updateDiscord, setActive, setFavorite, resetPassword }
})
