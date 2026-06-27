import type {
  ClientAdmin,
  AdminCreateClientRequest,
  Pagination,
  ClientCharacter,
  SaveClientCharacterRequest,
  Balance,
  LedgerEntry,
  IncomingBalance,
  Withdrawal
} from '#shared/types/api'

type ClientStatusFilter = 'all' | 'active' | 'inactive'

export const useAdminClientsStore = defineStore('admin-clients', () => {
  const clients = ref<ClientAdmin[]>([])
  const charactersByClient = ref<Record<number, ClientCharacter[]>>({})
  const balancesByClient = ref<Record<number, Balance>>({})
  const ledgerByClient = ref<Record<number, LedgerEntry[]>>({})
  const incomingByClient = ref<Record<number, IncomingBalance[]>>({})
  const withdrawalsByClient = ref<Record<number, Withdrawal[]>>({})
  const pagination = ref<Pagination | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref('')
  // the plaintext shown once after a create/reset (admin shares it with the player)
  const lastPassword = ref<{ username: string, password: string } | null>(null)

  async function load(params: { search?: string, status?: ClientStatusFilter, page?: number } = {}) {
    const { requestPaged } = useApi()
    loading.value = true
    error.value = ''
    try {
      const query: Record<string, string> = { limit: '10' }
      if (params.page) query.page = String(params.page)
      if (params.status && params.status !== 'all') query.status = params.status
      if (params.search?.trim()) query.search = params.search.trim()
      const { data, pagination: meta } = await requestPaged<ClientAdmin[]>('/api/v1/internal/clients', { query })
      clients.value = data ?? []
      pagination.value = meta
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
      clients.value = [row, ...clients.value].slice(0, pagination.value?.limit ?? 10)
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

  async function loadCharacters(clientId: number) {
    const { request } = useApi()
    error.value = ''
    try {
      charactersByClient.value[clientId] = await request<ClientCharacter[]>(`/api/v1/internal/clients/${clientId}/characters`)
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Could not load characters'
    }
  }

  async function createCharacter(clientId: number, payload: SaveClientCharacterRequest) {
    const { request } = useApi()
    saving.value = true
    error.value = ''
    try {
      const row = await request<ClientCharacter>(`/api/v1/internal/clients/${clientId}/characters`, { method: 'POST', body: payload })
      patchCharacter(clientId, row)
      return row
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Could not create character'
      throw cause
    } finally {
      saving.value = false
    }
  }

  async function updateCharacter(clientId: number, characterId: number, payload: SaveClientCharacterRequest) {
    const { request } = useApi()
    saving.value = true
    error.value = ''
    try {
      const row = await request<ClientCharacter>(`/api/v1/internal/clients/${clientId}/characters/${characterId}`, { method: 'PUT', body: payload })
      patchCharacter(clientId, row)
      return row
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Could not update character'
      throw cause
    } finally {
      saving.value = false
    }
  }

  async function deleteCharacter(clientId: number, characterId: number) {
    const { request } = useApi()
    error.value = ''
    try {
      await request<{ status: boolean }>(`/api/v1/internal/clients/${clientId}/characters/${characterId}`, { method: 'DELETE' })
      charactersByClient.value[clientId] = (charactersByClient.value[clientId] ?? []).filter(row => row.id !== characterId)
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Could not delete character'
      throw cause
    }
  }

  async function loadBalanceDetail(clientId: number) {
    const { request } = useApi()
    error.value = ''
    try {
      const [balance, ledger, incoming, withdrawals] = await Promise.all([
        request<Balance>(`/api/v1/internal/clients/${clientId}/balance`),
        request<LedgerEntry[]>(`/api/v1/internal/clients/${clientId}/balance/ledger?limit=10`),
        request<IncomingBalance[]>(`/api/v1/internal/clients/${clientId}/incoming-balances?limit=10`),
        request<Withdrawal[]>(`/api/v1/internal/clients/${clientId}/withdrawals?limit=10`)
      ])
      balancesByClient.value[clientId] = balance
      ledgerByClient.value[clientId] = ledger ?? []
      incomingByClient.value[clientId] = incoming ?? []
      withdrawalsByClient.value[clientId] = withdrawals ?? []
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Could not load balance detail'
    }
  }

  function patchCharacter(clientId: number, row: ClientCharacter) {
    const rows = charactersByClient.value[clientId] ?? []
    const i = rows.findIndex(character => character.id === row.id)
    if (i >= 0) rows[i] = row
    else rows.push(row)
    charactersByClient.value[clientId] = [...rows].sort((a, b) => a.character_name.localeCompare(b.character_name))
  }

  function patch(row: ClientAdmin) {
    const i = clients.value.findIndex(c => c.id === row.id)
    if (i >= 0) clients.value[i] = row
  }

  return {
    clients,
    charactersByClient,
    balancesByClient,
    ledgerByClient,
    incomingByClient,
    withdrawalsByClient,
    pagination,
    loading,
    saving,
    error,
    lastPassword,
    load,
    create,
    updateDiscord,
    setActive,
    setFavorite,
    resetPassword,
    loadCharacters,
    createCharacter,
    updateCharacter,
    deleteCharacter,
    loadBalanceDetail
  }
})
