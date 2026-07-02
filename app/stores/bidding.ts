import type { Auction, ClientSession, Item, Prebid, SessionInstance, SessionMember } from '#shared/types/api'

export const useBiddingStore = defineStore('bidding', () => {
  const auctions = ref<Auction[]>([])
  const prebids = ref<Prebid[]>([])
  const catalogItems = ref<Item[]>([])
  const myMember = ref<SessionMember | null>(null)
  const members = ref<SessionMember[]>([])
  const sessionInfo = ref<ClientSession | null>(null)
  const loading = ref(false)
  const bidding = ref(false)
  const error = ref('')
  const sessionUnavailable = ref<{ reason: 'deleted', message: string } | null>(null)
  const sessionEnded = ref(false)
  const currentSessionId = ref('')

  // most recent moment the caller lost a top bid (page watches this for a toast)
  const lastOutbid = ref<{ name: string, ts: number } | null>(null)
  const lastNewItem = ref<{ name: string, ts: number } | null>(null)

  const activeAuctions = computed(() => auctions.value.filter(a => a.status === 'active'))
  const openPrebids = computed(() => prebids.value.filter(p => p.status === 'open'))
  const closedAuctions = computed(() => auctions.value.filter(a => a.status !== 'active'))

  // true when the caller is the current top bidder on the given winner id
  function isMine(winnerMemberId: string) {
    return !!myMember.value && winnerMemberId === myMember.value.id
  }

  async function loadMyMember(sessionId: string) {
    const { request } = useApi()
    try {
      myMember.value = await request<SessionMember>(`/api/v1/client/members/me?session_id=${encodeURIComponent(sessionId)}`)
    } catch {
      myMember.value = null
    }
  }

  async function loadMembers(sessionId: string) {
    const { request } = useApi()
    try {
      members.value = await request<SessionMember[]>(`/api/v1/client/members?session_id=${encodeURIComponent(sessionId)}`)
    } catch {
      members.value = []
    }
  }

  // session info (title drives the raid theme + header)
  async function loadSession(sessionId: string) {
    const { request } = useApi()
    try {
      sessionInfo.value = await request<ClientSession>(`/api/v1/client/session/${encodeURIComponent(sessionId)}`)
    } catch {
      sessionInfo.value = null
    }
  }

  // the prebid catalog: every loot item from the session's raid instances, so
  // the player can open a prebid on any of them (V1 parity)
  async function loadCatalog(sessionId: string) {
    const { request } = useApi()
    try {
      const sessionInstances = await request<SessionInstance[]>(`/api/v1/client/session/${encodeURIComponent(sessionId)}/instances`)
      const instanceIds = (sessionInstances ?? []).map(instance => instance.id)
      if (!instanceIds.length) {
        catalogItems.value = []
        return
      }
      const lists = await Promise.all(instanceIds.map(async (id) => {
        const all: Item[] = []
        // the item list caps limit at 100, so page through until a short page
        for (let page = 1; page <= 20; page++) {
          const rows = await request<Item[]>(`/api/v1/client/items?instance_id=${id}&limit=100&page=${page}`).catch(() => [] as Item[])
          if (!rows?.length) break
          all.push(...rows)
          if (rows.length < 100) break
        }
        return all
      }))
      const seen = new Set<string>()
      const merged: Item[] = []
      for (const list of lists) {
        for (const item of list ?? []) {
          const key = item.wow_item_id ? `id:${item.wow_item_id}` : `name:${item.name.toLowerCase()}`
          if (seen.has(key)) continue
          seen.add(key)
          merged.push(item)
        }
      }
      catalogItems.value = merged
    } catch {
      catalogItems.value = []
    }
  }

  // the open prebid (if any) for a catalog item — by wow item id, else by name
  function openPrebidForItem(item: Item) {
    return prebids.value.find(p => p.status === 'open' && (
      (item.wow_item_id > 0 && p.item_id === item.wow_item_id)
      || (item.wow_item_id === 0 && p.item_name.toLowerCase() === item.name.toLowerCase())
    ))
  }

  // player opens a prebid on a catalog item (becomes the first prebidder)
  async function createPlayerPrebid(sessionId: string, payload: { item_name: string, item_id: number, initial_price: number }) {
    const { request } = useApi()
    bidding.value = true
    error.value = ''
    try {
      const created = await request<Prebid>(`/api/v1/client/sessions/${encodeURIComponent(sessionId)}/prebids`, {
        method: 'POST',
        body: payload
      })
      patchPrebid(created)
      return created
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Could not open prebid'
      throw cause
    } finally {
      bidding.value = false
    }
  }

  // display name for the current winner; 'You' when it's the caller
  function memberName(memberId: string) {
    if (!memberId) return '—'
    if (myMember.value && memberId === myMember.value.id) return 'You'
    return members.value.find(m => m.id === memberId)?.character_name ?? 'Unknown'
  }

  async function load(sessionId: string, options: { keepEnded?: boolean } = {}) {
    const { request } = useApi()
    currentSessionId.value = sessionId
    loading.value = true
    error.value = ''
    sessionUnavailable.value = null
    if (!options.keepEnded) sessionEnded.value = false
    try {
      const [auctionRows, prebidRows] = await Promise.all([
        request<Auction[]>(`/api/v1/client/auctions?session_id=${encodeURIComponent(sessionId)}`),
        request<Prebid[]>(`/api/v1/client/prebids?session_id=${encodeURIComponent(sessionId)}`)
      ])
      auctions.value = auctionRows ?? []
      prebids.value = prebidRows ?? []
      restoreOutbid()
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Failed to load the session'
      throw cause
    } finally {
      loading.value = false
    }
  }

  async function placeBid(auctionId: string, amount: number) {
    const { request } = useApi()
    bidding.value = true
    error.value = ''
    try {
      const updated = await request<Auction>(`/api/v1/client/auctions/${auctionId}/bids`, {
        method: 'POST',
        body: { amount }
      })
      patchAuction(updated)
      return updated
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Bid failed'
      throw cause
    } finally {
      bidding.value = false
    }
  }

  async function placePrebidBid(prebidId: string, amount: number) {
    const { request } = useApi()
    bidding.value = true
    error.value = ''
    try {
      const updated = await request<Prebid>(`/api/v1/client/prebids/${prebidId}/bids`, {
        method: 'POST',
        body: { amount }
      })
      patchPrebid(updated)
      return updated
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Prebid failed'
      throw cause
    } finally {
      bidding.value = false
    }
  }

  // Fallback poll: SSE is the primary path, but if the stream drops (proxy/dev
  // HMR/network) this keeps the board live + still fires outbid detection,
  // because it patches in place through the same patch* functions.
  async function refresh(sessionId: string) {
    const { request } = useApi()
    try {
      const [auctionRows, prebidRows] = await Promise.all([
        request<Auction[]>(`/api/v1/client/auctions?session_id=${encodeURIComponent(sessionId)}`),
        request<Prebid[]>(`/api/v1/client/prebids?session_id=${encodeURIComponent(sessionId)}`)
      ])
      for (const auction of auctionRows ?? []) patchAuction(auction)
      for (const prebid of prebidRows ?? []) patchPrebid(prebid)
    } catch {
      // ignore transient refresh failures; SSE / next poll recovers
    }
  }

  // --- realtime (SSE) ---
  const source = ref<EventSource | null>(null)

  function connect(sessionId: string) {
    disconnect()
    const es = new EventSource(`/api/v1/client/events?session_id=${encodeURIComponent(sessionId)}`)
    const onAuction = (e: Event) => patchAuction(JSON.parse((e as MessageEvent).data) as Auction)
    const onPrebid = (e: Event) => patchPrebid(JSON.parse((e as MessageEvent).data) as Prebid)
    const onAuctionCreated = (e: Event) => {
      const item = JSON.parse((e as MessageEvent).data) as Auction
      lastNewItem.value = { name: item.item_name, ts: Date.now() }
      patchAuction(item)
    }
    const onPrebidCreated = (e: Event) => {
      const item = JSON.parse((e as MessageEvent).data) as Prebid
      lastNewItem.value = { name: item.item_name, ts: Date.now() }
      patchPrebid(item)
    }
    const onSessionChanged = () => {
      void load(sessionId).catch(() => undefined)
    }
    const onSessionEnded = () => {
      sessionEnded.value = true
      void load(sessionId, { keepEnded: true }).catch(() => undefined)
    }
    const onSessionDeleted = () => {
      markSessionUnavailable('deleted', 'This session was deleted by admin.')
    }
    es.addEventListener('auction.created', onAuctionCreated)
    es.addEventListener('auction.updated', onAuction)
    es.addEventListener('prebid.created', onPrebidCreated)
    es.addEventListener('prebid.updated', onPrebid)
    es.addEventListener('session.updated', onSessionChanged)
    es.addEventListener('session.ended', onSessionEnded)
    es.addEventListener('session.deleted', onSessionDeleted)
    source.value = es
  }

  function disconnect() {
    source.value?.close()
    source.value = null
  }

  function markSessionUnavailable(reason: 'deleted', message: string) {
    auctions.value = []
    prebids.value = []
    error.value = ''
    sessionEnded.value = false
    sessionUnavailable.value = { reason, message }
    disconnect()
  }

  // patch in place so the list does not flicker/refetch on every bid
  function patchAuction(updated: Auction) {
    const i = auctions.value.findIndex(a => a.id === updated.id)
    const prev = i >= 0 ? auctions.value[i] : undefined
    if (prev) {
      detectOutbid(prev, updated)
      auctions.value[i] = updated
    } else {
      auctions.value = [updated, ...auctions.value]
    }
    clearOutbidIfLeading(updated)
  }

  function patchPrebid(updated: Prebid) {
    if (updated.spawned_auction) {
      patchAuction(updated.spawned_auction)
    }
    const i = prebids.value.findIndex(p => p.id === updated.id)
    const prev = i >= 0 ? prebids.value[i] : undefined
    if (prev) {
      detectOutbid(prev, updated)
      prebids.value[i] = updated
    } else {
      prebids.value = [updated, ...prebids.value]
    }
    clearOutbidIfLeading(updated)
  }

  // flag when an incoming update took the top bid away from the caller
  function detectOutbid(prev: Auction | Prebid, next: Auction | Prebid) {
    if (
      isMine(prev.current_winner_member_id)
      && !isMine(next.current_winner_member_id)
      && next.bid_count > prev.bid_count
    ) {
      lastOutbid.value = { name: next.item_name, ts: Date.now() }
      markOutbid(next.id) // mark the row red until the caller re-leads
    }
  }

  // ids of items where the caller was outbid (drives the red row state).
  // Persisted per session so the red survives a page refresh — detectOutbid
  // only fires on a live transition, which a fresh load has no memory of.
  const outbidIds = ref(new Set<string>())
  function isOutbid(id: string) {
    return outbidIds.value.has(id)
  }
  function outbidKey() {
    return `cb_outbid_${currentSessionId.value}`
  }
  function persistOutbid() {
    if (!import.meta.client || !currentSessionId.value) return
    localStorage.setItem(outbidKey(), JSON.stringify([...outbidIds.value]))
  }
  function markOutbid(id: string) {
    outbidIds.value.add(id)
    persistOutbid()
  }
  // clear the outbid flag once the caller is the top bidder again
  function clearOutbidIfLeading(item: Auction | Prebid) {
    if (isMine(item.current_winner_member_id) && outbidIds.value.has(item.id)) {
      outbidIds.value.delete(item.id)
      persistOutbid()
    }
  }
  // restore persisted outbid ids on load, dropping any item that is no longer
  // live (closed/resolved/cancelled) so stale flags don't accumulate
  function restoreOutbid() {
    if (!import.meta.client || !currentSessionId.value) {
      outbidIds.value = new Set()
      return
    }
    let stored: string[]
    try {
      stored = JSON.parse(localStorage.getItem(outbidKey()) || '[]')
    } catch {
      stored = []
    }
    const live = new Set<string>([
      ...auctions.value.filter(a => a.status === 'active').map(a => a.id),
      ...prebids.value.filter(p => p.status === 'open').map(p => p.id)
    ])
    outbidIds.value = new Set(stored.filter(id => live.has(id)))
    persistOutbid()
  }

  return {
    auctions,
    prebids,
    activeAuctions,
    openPrebids,
    closedAuctions,
    lastOutbid,
    lastNewItem,
    sessionUnavailable,
    sessionEnded,
    myMember,
    members,
    sessionInfo,
    isMine,
    isOutbid,
    memberName,
    loadMyMember,
    loadMembers,
    loadSession,
    loadCatalog,
    catalogItems,
    openPrebidForItem,
    createPlayerPrebid,
    refresh,
    loading,
    bidding,
    error,
    load,
    placeBid,
    placePrebidBid,
    connect,
    disconnect
  }
})
