import type { Auction, Prebid, SessionMember } from '#shared/types/api'

export const useBiddingStore = defineStore('bidding', () => {
  const auctions = ref<Auction[]>([])
  const prebids = ref<Prebid[]>([])
  const myMember = ref<SessionMember | null>(null)
  const members = ref<SessionMember[]>([])
  const loading = ref(false)
  const bidding = ref(false)
  const error = ref('')
  const sessionUnavailable = ref<{ reason: 'deleted', message: string } | null>(null)

  // most recent moment the caller lost a top bid (page watches this for a toast)
  const lastOutbid = ref<{ name: string, ts: number } | null>(null)

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

  // display name for the current winner; 'You' when it's the caller
  function memberName(memberId: string) {
    if (!memberId) return '—'
    if (myMember.value && memberId === myMember.value.id) return 'You'
    return members.value.find(m => m.id === memberId)?.character_name ?? 'Unknown'
  }

  async function load(sessionId: string) {
    const { request } = useApi()
    loading.value = true
    error.value = ''
    sessionUnavailable.value = null
    try {
      const [auctionRows, prebidRows] = await Promise.all([
        request<Auction[]>(`/api/v1/client/auctions?session_id=${encodeURIComponent(sessionId)}`),
        request<Prebid[]>(`/api/v1/client/prebids?session_id=${encodeURIComponent(sessionId)}`)
      ])
      auctions.value = auctionRows ?? []
      prebids.value = prebidRows ?? []
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

  // --- realtime (SSE) ---
  const source = ref<EventSource | null>(null)

  function connect(sessionId: string) {
    disconnect()
    const es = new EventSource(`/api/v1/client/events?session_id=${encodeURIComponent(sessionId)}`)
    const onAuction = (e: Event) => patchAuction(JSON.parse((e as MessageEvent).data) as Auction)
    const onPrebid = (e: Event) => patchPrebid(JSON.parse((e as MessageEvent).data) as Prebid)
    const onSessionChanged = () => {
      void load(sessionId).catch(() => undefined)
    }
    const onSessionDeleted = () => {
      markSessionUnavailable('deleted', 'This session was deleted by admin.')
    }
    es.addEventListener('auction.created', onAuction)
    es.addEventListener('auction.updated', onAuction)
    es.addEventListener('prebid.created', onPrebid)
    es.addEventListener('prebid.updated', onPrebid)
    es.addEventListener('session.updated', onSessionChanged)
    es.addEventListener('session.ended', onSessionChanged)
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
  }

  // flag when an incoming update took the top bid away from the caller
  function detectOutbid(prev: Auction | Prebid, next: Auction | Prebid) {
    if (
      isMine(prev.current_winner_member_id)
      && !isMine(next.current_winner_member_id)
      && next.bid_count > prev.bid_count
    ) {
      lastOutbid.value = { name: next.item_name, ts: Date.now() }
    }
  }

  return {
    auctions,
    prebids,
    activeAuctions,
    openPrebids,
    closedAuctions,
    lastOutbid,
    sessionUnavailable,
    myMember,
    members,
    isMine,
    memberName,
    loadMyMember,
    loadMembers,
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
