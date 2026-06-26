import type {
  Session,
  Auction,
  Prebid,
  SessionMember,
  CreateAuctionRequest,
  CreatePrebidRequest
} from '#shared/types/api'

export const useAdminSessionStore = defineStore('admin-session', () => {
  const session = ref<Session | null>(null)
  const auctions = ref<Auction[]>([])
  const prebids = ref<Prebid[]>([])
  const members = ref<SessionMember[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const error = ref('')

  async function load(id: string) {
    const { request } = useApi()
    loading.value = true
    error.value = ''
    try {
      const [s, a, p, m] = await Promise.all([
        request<Session>(`/api/v1/internal/sessions/${id}`),
        request<Auction[]>(`/api/v1/internal/sessions/${id}/auctions`),
        request<Prebid[]>(`/api/v1/internal/sessions/${id}/prebids`),
        request<SessionMember[]>(`/api/v1/internal/sessions/${id}/members`)
      ])
      session.value = s
      auctions.value = a ?? []
      prebids.value = p ?? []
      members.value = m ?? []
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Failed to load session'
      throw cause
    } finally {
      loading.value = false
    }
  }

  async function refresh(id: string) {
    const { request } = useApi()
    try {
      const [a, p] = await Promise.all([
        request<Auction[]>(`/api/v1/internal/sessions/${id}/auctions`),
        request<Prebid[]>(`/api/v1/internal/sessions/${id}/prebids`)
      ])
      auctions.value = a ?? []
      prebids.value = p ?? []
    } catch {
      // keep last good state on a transient refresh failure
    }
  }

  async function createAuction(sessionId: string, payload: CreateAuctionRequest) {
    const { request } = useApi()
    saving.value = true
    error.value = ''
    try {
      const created = await request<Auction>(`/api/v1/internal/sessions/${sessionId}/auctions`, {
        method: 'POST',
        body: payload
      })
      auctions.value = [created, ...auctions.value]
      return created
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Could not open auction'
      throw cause
    } finally {
      saving.value = false
    }
  }

  async function createPrebid(sessionId: string, payload: CreatePrebidRequest) {
    const { request } = useApi()
    saving.value = true
    error.value = ''
    try {
      const created = await request<Prebid>(`/api/v1/internal/sessions/${sessionId}/prebids`, {
        method: 'POST',
        body: payload
      })
      prebids.value = [created, ...prebids.value]
      return created
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Could not create prebid'
      throw cause
    } finally {
      saving.value = false
    }
  }

  async function auctionAction(id: string, action: 'close' | 'cancel' | 'reset') {
    const { request } = useApi()
    error.value = ''
    try {
      const updated = await request<Auction>(`/api/v1/internal/auctions/${id}/${action}`, { method: 'POST' })
      patchAuction(updated)
      return updated
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : `Auction ${action} failed`
      throw cause
    }
  }

  async function prebidAction(id: string, action: 'resolve' | 'cancel', sessionId: string) {
    const { request } = useApi()
    error.value = ''
    try {
      const updated = await request<Prebid>(`/api/v1/internal/prebids/${id}/${action}`, { method: 'POST' })
      patchPrebid(updated)
      // resolving spawns a new auction; pull the fresh auction list
      if (action === 'resolve') {
        await refresh(sessionId)
      }
      return updated
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : `Prebid ${action} failed`
      throw cause
    }
  }

  function patchAuction(updated: Auction) {
    const i = auctions.value.findIndex(a => a.id === updated.id)
    if (i >= 0) auctions.value[i] = updated
  }

  function patchPrebid(updated: Prebid) {
    const i = prebids.value.findIndex(p => p.id === updated.id)
    if (i >= 0) prebids.value[i] = updated
  }

  return {
    session,
    auctions,
    prebids,
    members,
    loading,
    saving,
    error,
    load,
    refresh,
    createAuction,
    createPrebid,
    auctionAction,
    prebidAction
  }
})
