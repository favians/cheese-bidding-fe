import type {
  Session,
  Auction,
  Prebid,
  SessionInstance,
  SessionMember,
  SessionSummary,
  CreateAuctionRequest,
  CreatePrebidRequest
} from '#shared/types/api'

export const useAdminSessionStore = defineStore('admin-session', () => {
  const session = ref<Session | null>(null)
  const auctions = ref<Auction[]>([])
  const prebids = ref<Prebid[]>([])
  const members = ref<SessionMember[]>([])
  const sessionInstances = ref<SessionInstance[]>([])
  const summary = ref<SessionSummary | null>(null)
  const lastNewItem = ref<{ name: string, ts: number } | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref('')

  async function load(id: string) {
    const { request } = useApi()
    loading.value = true
    error.value = ''
    // clear the previous session so its (possibly ended) state doesn't linger
    // while navigating between sessions
    session.value = null
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
    // instances is non-critical: a failure here must not blank the session panel
    try {
      sessionInstances.value = await request<SessionInstance[]>(`/api/v1/internal/sessions/${id}/instances`) ?? []
    } catch {
      sessionInstances.value = []
    }
    await loadSummary(id)
  }

  // patchRows merges incoming rows into the existing list by id, reusing the
  // existing object for unchanged rows so the 2s admin poll doesn't replace the
  // whole array (which makes the board flicker / re-render). Object identity is
  // preserved for rows still present, so Vue's keyed diff does minimal DOM work.
  function patchRows<T extends { id: string, item_name: string }>(target: Ref<T[]>, incoming: T[]) {
    const byId = new Map(target.value.map(row => [row.id, row]))
    target.value = incoming.map((row) => {
      const existing = byId.get(row.id)
      if (existing) {
        Object.assign(existing, row)
        return existing
      }
      // a row not seen last poll = a newly-added item (page plays a sound)
      lastNewItem.value = { name: row.item_name, ts: Date.now() }
      return row
    })
  }

  async function refresh(id: string) {
    const { request } = useApi()
    try {
      const [a, p] = await Promise.all([
        request<Auction[]>(`/api/v1/internal/sessions/${id}/auctions`),
        request<Prebid[]>(`/api/v1/internal/sessions/${id}/prebids`)
      ])
      patchRows(auctions, a ?? [])
      patchRows(prebids, p ?? [])
      await loadSummary(id)
    } catch {
      // keep last good state on a transient refresh failure
    }
  }

  async function loadSummary(id: string) {
    const { request } = useApi()
    try {
      summary.value = await request<SessionSummary>(`/api/v1/internal/sessions/${id}/summary`)
    } catch {
      summary.value = null
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
      lastNewItem.value = { name: created.item_name, ts: Date.now() }
      await loadSummary(sessionId)
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
      lastNewItem.value = { name: created.item_name, ts: Date.now() }
      await loadSummary(sessionId)
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
      await loadSummary(updated.session_id)
      return updated
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : `Auction ${action} failed`
      throw cause
    }
  }

  async function prebidAction(id: string, action: 'resolve' | 'cancel' | 'delete-last-bid', sessionId: string) {
    const { request } = useApi()
    error.value = ''
    try {
      const updated = await request<Prebid>(`/api/v1/internal/prebids/${id}/${action}`, { method: 'POST' })
      patchPrebid(updated)
      if (updated.spawned_auction) {
        patchAuction(updated.spawned_auction)
      }
      // resolving spawns a new auction; pull the fresh auction list
      if (action === 'resolve') {
        await refresh(sessionId)
      } else {
        await loadSummary(sessionId)
      }
      return updated
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : `Prebid ${action} failed`
      throw cause
    }
  }

  async function saveInstances(sessionId: string, instanceIds: number[]) {
    const { request } = useApi()
    error.value = ''
    saving.value = true
    try {
      const updated = await request<SessionInstance[]>(`/api/v1/internal/sessions/${sessionId}/instances`, {
        method: 'PUT',
        body: { instance_ids: instanceIds }
      })
      sessionInstances.value = updated ?? []
      return updated
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Session instances could not be saved'
      throw cause
    } finally {
      saving.value = false
    }
  }

  function patchAuction(updated: Auction) {
    const i = auctions.value.findIndex(a => a.id === updated.id)
    if (i >= 0) auctions.value[i] = updated
    else auctions.value = [updated, ...auctions.value]
  }

  function patchPrebid(updated: Prebid) {
    const i = prebids.value.findIndex(p => p.id === updated.id)
    if (i >= 0) prebids.value[i] = updated
    else prebids.value = [updated, ...prebids.value]
  }

  return {
    session,
    auctions,
    prebids,
    members,
    sessionInstances,
    summary,
    lastNewItem,
    loading,
    saving,
    error,
    load,
    refresh,
    loadSummary,
    createAuction,
    createPrebid,
    auctionAction,
    prebidAction,
    saveInstances
  }
})
