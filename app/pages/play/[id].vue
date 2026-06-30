<script setup lang="ts">
import type { Auction, Prebid } from '#shared/types/api'

definePageMeta({ middleware: 'auth' })

type PlayerTab = 'bid' | 'prebid'

const route = useRoute()
const sessionId = computed(() => String(route.params.id))
const bidding = useBiddingStore()
const { activeAuctions, openPrebids, closedAuctions, lastOutbid, sessionUnavailable, sessionEnded, loading, bidding: submitting, error } = storeToRefs(bidding)

const toast = useToast()
watch(lastOutbid, (v) => {
  if (v) {
    toast.add({ title: 'Outbid!', description: v.name, color: 'error', icon: 'i-lucide-bell-ring' })
  }
})

const bidInputs = reactive<Record<string, number | undefined>>({})
const playerTab = ref<PlayerTab>('bid')

const now = ref(Date.now())
let clock: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  bidding.load(sessionId.value)
  bidding.loadMyMember(sessionId.value)
  bidding.loadMembers(sessionId.value)
  bidding.connect(sessionId.value)
  // timer auto-closes now arrive over SSE (scheduler publishes); just tick the clock
  clock = setInterval(() => (now.value = Date.now()), 1000)
})

onBeforeUnmount(() => {
  if (clock) clearInterval(clock)
  bidding.disconnect()
})

function secondsLeft(endsAt?: string | null) {
  if (!endsAt) return 0
  const endMs = new Date(endsAt).getTime()
  if (Number.isNaN(endMs)) return 0
  return Math.max(0, Math.floor((endMs - now.value) / 1000))
}

function countdown(endsAt?: string | null) {
  const total = secondsLeft(endsAt)
  if (total <= 0) return 'closing…'
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

async function bidAuction(item: Auction, amount: number) {
  if (amount < item.next_min_bid) return
  if (bidding.isMine(item.current_winner_member_id)) {
    if (!window.confirm('You are already winning this item. Bid against yourself anyway?')) return
  }
  try {
    await bidding.placeBid(item.id, amount)
    bidInputs[item.id] = undefined
  } catch {
    // store exposes the error
  }
}

async function bidPrebid(item: Prebid, amount: number) {
  if (amount < item.next_min_bid) return
  if (bidding.isMine(item.current_winner_member_id)) {
    if (!window.confirm('You are already leading this prebid. Bid again anyway?')) return
  }
  try {
    await bidding.placePrebidBid(item.id, amount)
    bidInputs[item.id] = undefined
  } catch {
    // store exposes the error
  }
}

function canCustomBid(item: Auction | Prebid) {
  const amount = bidInputs[item.id]
  return typeof amount === 'number' && amount >= item.next_min_bid
}
</script>

<template>
  <main class="public-shell live-session-shell">
    <header class="topbar">
      <div class="brand">
        <div class="brand-head">
          <span class="brand-logo">🧀 Cheese GDKP</span>
        </div>
        <h1>Bidding</h1>
        <p>Session <span class="font-mono">{{ sessionId }}</span></p>
      </div>
      <UButton
        color="neutral"
        variant="ghost"
        icon="i-lucide-arrow-left"
        label="Leave"
        to="/play"
      />
    </header>

    <UAlert
      v-if="sessionUnavailable"
      color="warning"
      variant="soft"
      icon="i-lucide-circle-alert"
      title="Session unavailable"
      :description="sessionUnavailable.message"
      class="mb-4"
    >
      <template #actions>
        <UButton
          color="warning"
          variant="solid"
          icon="i-lucide-arrow-left"
          label="Back to join"
          to="/play"
        />
      </template>
    </UAlert>

    <UAlert
      v-else-if="error"
      color="error"
      variant="soft"
      icon="i-lucide-circle-alert"
      :title="error"
      class="mb-4"
    />

    <UAlert
      v-if="sessionEnded"
      color="success"
      variant="soft"
      icon="i-lucide-flag"
      title="Session ended"
      description="Bidding is closed. Final results are shown below."
      class="mb-4"
    />

    <section class="player-board">
      <div class="player-board-head">
        <div
          class="player-table-tabs"
          role="tablist"
          aria-label="Live bidding view"
        >
          <button
            type="button"
            role="tab"
            :aria-selected="playerTab === 'bid'"
            :class="{ 'active': playerTab === 'bid', 'has-items': activeAuctions.length > 0 }"
            @click="playerTab = 'bid'"
          >
            Bid <span>{{ activeAuctions.length }}</span>
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="playerTab === 'prebid'"
            :class="{ 'active': playerTab === 'prebid', 'has-items': openPrebids.length > 0 }"
            @click="playerTab = 'prebid'"
          >
            Prebid <span>{{ openPrebids.length }}</span>
          </button>
        </div>
        <span v-if="playerTab === 'prebid'">{{ openPrebids.length }} open</span>
        <span v-else>{{ activeAuctions.length }} live</span>
      </div>
      <div
        v-if="loading && !activeAuctions.length && !openPrebids.length"
        class="player-empty"
      >
        Loading…
      </div>
      <template v-else-if="playerTab === 'bid'">
        <div
          v-if="!activeAuctions.length"
          class="player-empty"
        >
          No live auctions right now.
        </div>
        <div
          v-else
          class="player-card-list"
        >
          <article
            v-for="item in activeAuctions"
            :key="item.id"
            class="auction-card"
            :class="{ winning: bidding.isMine(item.current_winner_member_id) }"
          >
            <div class="loot-cell">
              <div class="item-icon">
                <img
                  v-if="item.item_id"
                  :src="`/icons/${item.item_id}.jpg`"
                  alt=""
                >
                <span v-else>?</span>
              </div>
              <div class="loot-text">
                <div class="item-name">
                  <span class="item-name-main">{{ item.item_name }}</span>
                  <span
                    v-if="bidding.isMine(item.current_winner_member_id)"
                    class="bid-you-pill"
                  >
                    Winning
                  </span>
                </div>
                <div class="loot-sub">
                  Min {{ item.min_bid }} · Inc {{ item.bid_increment }} · {{ item.bid_count }} bids
                </div>
              </div>
            </div>

            <div class="bid-state">
              <div class="bid-main">
                Bid <strong>{{ item.current_bid || '—' }}</strong>
              </div>
              <div class="bid-by">
                <span v-if="item.current_winner_member_id">
                  by <span :class="{ 'bid-you': bidding.isMine(item.current_winner_member_id) }">{{ bidding.memberName(item.current_winner_member_id) }}</span>
                </span>
                <span v-else>No bids yet</span>
              </div>
            </div>

            <div class="timer-cell">
              <span class="status active">active</span>
              <strong :class="{ danger: secondsLeft(item.ends_at) <= 10 }">{{ countdown(item.ends_at) }}</strong>
            </div>

            <div class="bid-controls">
              <UButton
                class="min-button"
                color="primary"
                icon="i-lucide-gavel"
                label="Min"
                :loading="submitting"
                @click="bidAuction(item, item.next_min_bid)"
              />
              <label class="bid-input">
                <span>Your Bid</span>
                <UInput
                  v-model.number="bidInputs[item.id]"
                  type="number"
                  :min="item.next_min_bid"
                  :placeholder="String(item.next_min_bid)"
                />
              </label>
              <UButton
                color="neutral"
                variant="solid"
                label="Bid"
                :loading="submitting"
                :disabled="!canCustomBid(item)"
                @click="bidAuction(item, bidInputs[item.id] ?? item.next_min_bid)"
              />
            </div>
          </article>
        </div>
      </template>
      <template v-else>
        <div
          v-if="!openPrebids.length"
          class="player-empty"
        >
          No open prebids.
        </div>
        <div
          v-else
          class="player-card-list"
        >
          <article
            v-for="item in openPrebids"
            :key="item.id"
            class="auction-card prebid-card"
            :class="{ winning: bidding.isMine(item.current_winner_member_id) }"
          >
            <div class="loot-cell">
              <div class="item-icon">
                <img
                  v-if="item.item_id"
                  :src="`/icons/${item.item_id}.jpg`"
                  alt=""
                >
                <span v-else>?</span>
              </div>
              <div class="loot-text">
                <div class="item-name">
                  <span class="item-name-main">{{ item.item_name }}</span>
                  <span
                    v-if="bidding.isMine(item.current_winner_member_id)"
                    class="bid-you-pill"
                  >
                    Leading
                  </span>
                </div>
                <div class="loot-sub">
                  Prebid · Inc {{ item.bid_increment }} · {{ item.bid_count }} bids
                </div>
              </div>
            </div>

            <div class="bid-state">
              <div class="bid-main">
                Prebid <strong>{{ item.current_bid || '—' }}</strong>
              </div>
              <div class="bid-by">
                <span v-if="item.current_winner_member_id">
                  by <span :class="{ 'bid-you': bidding.isMine(item.current_winner_member_id) }">{{ bidding.memberName(item.current_winner_member_id) }}</span>
                </span>
                <span v-else>No prebids yet</span>
              </div>
            </div>

            <div class="timer-cell">
              <span class="status open">open</span>
              <strong>No timer</strong>
            </div>

            <div class="bid-controls prebid-controls">
              <label class="bid-input">
                <span>Your Prebid</span>
                <UInput
                  v-model.number="bidInputs[item.id]"
                  type="number"
                  :min="item.next_min_bid"
                  :placeholder="String(item.next_min_bid)"
                />
              </label>
              <UButton
                color="primary"
                variant="solid"
                label="Outbid"
                :loading="submitting"
                @click="bidPrebid(item, bidInputs[item.id] ?? item.next_min_bid)"
              />
            </div>
          </article>
        </div>
      </template>
    </section>

    <section
      v-if="closedAuctions.length"
      class="player-board results-board"
    >
      <div class="player-board-head">
        <h2>Results</h2>
        <span>{{ closedAuctions.length }} finished</span>
      </div>
      <div class="player-result-list">
        <div
          v-for="item in closedAuctions"
          :key="item.id"
          class="result-row"
          :class="{ sold: bidding.isMine(item.winner_member_id), cancelled: item.status === 'cancelled' }"
        >
          <span>
            <strong>{{ item.item_name }}</strong>
            <span class="ml-2 opacity-70">{{ item.status }}</span>
          </span>
          <span>
            <template v-if="item.status === 'cancelled'">cancelled</template>
            <template v-else-if="bidding.isMine(item.winner_member_id)">
              🎉 You won for <strong>{{ item.winning_bid }}</strong>
            </template>
            <template v-else-if="item.winning_bid">
              {{ bidding.memberName(item.winner_member_id) }} won for <strong>{{ item.winning_bid }}</strong>
            </template>
            <template v-else>no bids</template>
          </span>
        </div>
      </div>
    </section>
  </main>
</template>
