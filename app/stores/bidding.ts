import type { Auction, Prebid, SessionMember } from '#shared/types/api'

export const useBiddingStore = defineStore('bidding', () => {
  const auctions = ref<Auction[]>([])
  const prebids = ref<Prebid[]>([])
  const myMember = ref<SessionMember | null>(null)
  const loading = ref(false)
  const bidding = ref(false)
  const error = ref('')

  const activeAuctions = computed(() => auctions.value.filter(a => a.status === 'active'))
  const openPrebids = computed(() => prebids.value.filter(p => p.status === 'open'))

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

  async function load(sessionId: string) {
    const { request } = useApi()
    loading.value = true
    error.value = ''
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
    es.addEventListener('auction.created', onAuction)
    es.addEventListener('auction.updated', onAuction)
    es.addEventListener('prebid.created', onPrebid)
    es.addEventListener('prebid.updated', onPrebid)
    source.value = es
  }

  function disconnect() {
    source.value?.close()
    source.value = null
  }

  // patch in place so the list does not flicker/refetch on every bid
  function patchAuction(updated: Auction) {
    const i = auctions.value.findIndex(a => a.id === updated.id)
    if (i >= 0) {
      auctions.value[i] = updated
    } else {
      auctions.value = [updated, ...auctions.value]
    }
  }

  function patchPrebid(updated: Prebid) {
    const i = prebids.value.findIndex(p => p.id === updated.id)
    if (i >= 0) {
      prebids.value[i] = updated
    } else {
      prebids.value = [updated, ...prebids.value]
    }
  }

  return {
    auctions,
    prebids,
    activeAuctions,
    openPrebids,
    myMember,
    isMine,
    loadMyMember,
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
