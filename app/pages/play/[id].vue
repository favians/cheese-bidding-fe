<script setup lang="ts">
import type { Auction, Prebid } from '#shared/types/api'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const sessionId = computed(() => String(route.params.id))
const bidding = useBiddingStore()
const { activeAuctions, openPrebids, loading, bidding: submitting, error } = storeToRefs(bidding)

// bid amount per item id (defaults to the item's next minimum)
const bidInputs = reactive<Record<string, number | undefined>>({})

// ticking clock for live countdowns
const now = ref(Date.now())
let clock: ReturnType<typeof setInterval> | undefined
// auctions we've already refetched once after their timer elapsed
const expiredRefetched = new Set<string>()

onMounted(() => {
  bidding.load(sessionId.value)
  // realtime: bids/opens/closes arrive over SSE and patch in place
  bidding.connect(sessionId.value)
  clock = setInterval(() => {
    now.value = Date.now()
    // the scheduler's bulk auto-close does not emit SSE; refetch once per
    // auction when its timer elapses so the closed state shows up
    for (const a of activeAuctions.value) {
      if (!expiredRefetched.has(a.id) && new Date(a.ends_at).getTime() <= now.value) {
        expiredRefetched.add(a.id)
        bidding.load(sessionId.value)
      }
    }
  }, 1000)
})

onBeforeUnmount(() => {
  if (clock) clearInterval(clock)
  bidding.disconnect()
})

function countdown(endsAt: string) {
  const ms = new Date(endsAt).getTime() - now.value
  if (ms <= 0) return 'closing…'
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

async function bidAuction(item: Auction) {
  const amount = bidInputs[item.id] ?? item.next_min_bid
  try {
    await bidding.placeBid(item.id, amount)
    bidInputs[item.id] = undefined
  } catch {
    // store exposes the error
  }
}

async function bidPrebid(item: Prebid) {
  const amount = bidInputs[item.id] ?? item.next_min_bid
  try {
    await bidding.placePrebidBid(item.id, amount)
    bidInputs[item.id] = undefined
  } catch {
    // store exposes the error
  }
}
</script>

<template>
  <main class="public-shell">
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
      v-if="error"
      color="error"
      variant="soft"
      icon="i-lucide-circle-alert"
      :title="error"
      class="mb-4"
    />

    <section class="mb-8">
      <h2 class="mb-3 text-lg font-semibold">
        Live Auctions
      </h2>
      <div
        v-if="loading && !activeAuctions.length"
        class="py-8 text-center opacity-70"
      >
        Loading…
      </div>
      <div
        v-else-if="!activeAuctions.length"
        class="py-8 text-center opacity-70"
      >
        No live auctions right now.
      </div>
      <div
        v-else
        class="grid gap-3"
      >
        <UCard
          v-for="item in activeAuctions"
          :key="item.id"
          class="profile-hero-card"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <strong class="text-lg">{{ item.item_name }}</strong>
              <div class="mt-1 text-sm opacity-80">
                Current <strong>{{ item.current_bid || '—' }}</strong>
                · next min {{ item.next_min_bid }}
                · {{ item.bid_count }} bids
              </div>
            </div>
            <UBadge
              color="warning"
              variant="soft"
              icon="i-lucide-timer"
            >
              {{ countdown(item.ends_at) }}
            </UBadge>
          </div>
          <div class="mt-3 flex items-center gap-2">
            <UInput
              v-model.number="bidInputs[item.id]"
              type="number"
              class="w-40"
              :placeholder="String(item.next_min_bid)"
            />
            <UButton
              color="primary"
              icon="i-lucide-gavel"
              label="Bid"
              :loading="submitting"
              @click="bidAuction(item)"
            />
          </div>
        </UCard>
      </div>
    </section>

    <section>
      <h2 class="mb-3 text-lg font-semibold">
        Prebids
      </h2>
      <div
        v-if="!openPrebids.length"
        class="py-8 text-center opacity-70"
      >
        No open prebids.
      </div>
      <div
        v-else
        class="grid gap-3"
      >
        <UCard
          v-for="item in openPrebids"
          :key="item.id"
          class="profile-hero-card"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <strong class="text-lg">{{ item.item_name }}</strong>
              <div class="mt-1 text-sm opacity-80">
                Current <strong>{{ item.current_bid || '—' }}</strong>
                · next min {{ item.next_min_bid }}
                · {{ item.bid_count }} bids
              </div>
            </div>
            <UBadge
              color="neutral"
              variant="soft"
            >
              prebid
            </UBadge>
          </div>
          <div class="mt-3 flex items-center gap-2">
            <UInput
              v-model.number="bidInputs[item.id]"
              type="number"
              class="w-40"
              :placeholder="String(item.next_min_bid)"
            />
            <UButton
              color="primary"
              icon="i-lucide-gavel"
              label="Prebid"
              :loading="submitting"
              @click="bidPrebid(item)"
            />
          </div>
        </UCard>
      </div>
    </section>
  </main>
</template>
