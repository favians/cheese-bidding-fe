import type { Auction, Prebid } from '#shared/types/api'

export const useBiddingStore = defineStore('bidding', () => {
  const auctions = ref<Auction[]>([])
  const prebids = ref<Prebid[]>([])
  const loading = ref(false)
  const bidding = ref(false)
  const error = ref('')

  const activeAuctions = computed(() => auctions.value.filter(a => a.status === 'active'))
  const openPrebids = computed(() => prebids.value.filter(p => p.status === 'open'))

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
    loading,
    bidding,
    error,
    load,
    placeBid,
    placePrebidBid
  }
})
