<script setup lang="ts">
import type { Auction, Prebid } from '#shared/types/api'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const sessionId = computed(() => String(route.params.id))
const bidding = useBiddingStore()
const { activeAuctions, openPrebids, closedAuctions, lastOutbid, sessionUnavailable, loading, bidding: submitting, error } = storeToRefs(bidding)

const toast = useToast()
watch(lastOutbid, (v) => {
  if (v) {
    toast.add({ title: 'Outbid!', description: v.name, color: 'error', icon: 'i-lucide-bell-ring' })
  }
})

const bidInputs = reactive<Record<string, number | undefined>>({})

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

function secondsLeft(endsAt: string) {
  return Math.max(0, Math.floor((new Date(endsAt).getTime() - now.value) / 1000))
}

function countdown(endsAt: string) {
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
          :class="{ 'ring-2 ring-(--color-cheese-400)': bidding.isMine(item.current_winner_member_id) }"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div class="flex items-center gap-2">
                <img
                  v-if="item.item_id"
                  :src="`/icons/${item.item_id}.jpg`"
                  class="h-11 w-11 rounded ring-1 ring-white/15"
                  alt=""
                >
                <strong class="text-lg">{{ item.item_name }}</strong>
                <UBadge
                  v-if="bidding.isMine(item.current_winner_member_id)"
                  color="success"
                  variant="solid"
                  icon="i-lucide-crown"
                >
                  Winning
                </UBadge>
              </div>
              <div class="mt-1 text-sm opacity-80">
                Current <strong>{{ item.current_bid || '—' }}</strong>
                <span v-if="item.current_winner_member_id">· {{ bidding.memberName(item.current_winner_member_id) }} leading</span>
                · {{ item.bid_count }} bids
              </div>
            </div>
            <UBadge
              :color="secondsLeft(item.ends_at) <= 10 ? 'error' : 'warning'"
              variant="soft"
              icon="i-lucide-timer"
              :class="{ 'animate-pulse': secondsLeft(item.ends_at) <= 10 }"
            >
              {{ countdown(item.ends_at) }}
            </UBadge>
          </div>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <UButton
              color="primary"
              icon="i-lucide-gavel"
              :label="`Bid ${item.next_min_bid}`"
              :loading="submitting"
              @click="bidAuction(item, item.next_min_bid)"
            />
            <div class="flex items-center gap-1">
              <UInput
                v-model.number="bidInputs[item.id]"
                type="number"
                class="w-32"
                :placeholder="`> ${item.next_min_bid}`"
              />
              <UButton
                color="neutral"
                variant="soft"
                label="Bid"
                :loading="submitting"
                :disabled="!canCustomBid(item)"
                @click="bidAuction(item, bidInputs[item.id] ?? item.next_min_bid)"
              />
            </div>
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
          :class="{ 'ring-2 ring-(--color-cheese-400)': bidding.isMine(item.current_winner_member_id) }"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div class="flex items-center gap-2">
                <img
                  v-if="item.item_id"
                  :src="`/icons/${item.item_id}.jpg`"
                  class="h-11 w-11 rounded ring-1 ring-white/15"
                  alt=""
                >
                <strong class="text-lg">{{ item.item_name }}</strong>
                <UBadge
                  v-if="bidding.isMine(item.current_winner_member_id)"
                  color="success"
                  variant="solid"
                  icon="i-lucide-crown"
                >
                  Leading
                </UBadge>
                <UBadge
                  v-else
                  color="neutral"
                  variant="soft"
                >
                  prebid
                </UBadge>
              </div>
              <div class="mt-1 text-sm opacity-80">
                Current <strong>{{ item.current_bid || '—' }}</strong>
                <span v-if="item.current_winner_member_id">· {{ bidding.memberName(item.current_winner_member_id) }} leading</span>
                · {{ item.bid_count }} bids
              </div>
            </div>
          </div>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <UButton
              color="primary"
              icon="i-lucide-gavel"
              :label="`Prebid ${item.next_min_bid}`"
              :loading="submitting"
              @click="bidPrebid(item, item.next_min_bid)"
            />
            <div class="flex items-center gap-1">
              <UInput
                v-model.number="bidInputs[item.id]"
                type="number"
                class="w-32"
                :placeholder="`> ${item.next_min_bid}`"
              />
              <UButton
                color="neutral"
                variant="soft"
                label="Bid"
                :loading="submitting"
                :disabled="!canCustomBid(item)"
                @click="bidPrebid(item, bidInputs[item.id] ?? item.next_min_bid)"
              />
            </div>
          </div>
        </UCard>
      </div>
    </section>

    <section
      v-if="closedAuctions.length"
      class="mt-8"
    >
      <h2 class="mb-3 text-lg font-semibold">
        Results
      </h2>
      <div class="grid gap-2">
        <div
          v-for="item in closedAuctions"
          :key="item.id"
          class="flex items-center justify-between rounded-lg px-3 py-2 text-sm opacity-90"
          :class="bidding.isMine(item.winner_member_id) ? 'bg-(--color-cheese-400)/15' : 'bg-white/5'"
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
