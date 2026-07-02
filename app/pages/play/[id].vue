<script setup lang="ts">
import type { Auction, Item, Prebid } from '#shared/types/api'

definePageMeta({ middleware: 'auth' })

type PlayerTab = 'bid' | 'prebid'

const route = useRoute()
const sessionId = computed(() => String(route.params.id))
const bidding = useBiddingStore()
const { activeAuctions, openPrebids, catalogItems, lastOutbid, lastNewItem, sessionUnavailable, sessionEnded, sessionInfo, loading, bidding: submitting, error } = storeToRefs(bidding)

// reflect the session's raid theme onto the page (V1 parity)
useInstanceTheme(() => sessionInfo.value?.title)

// group the live board into instance → boss → items (V1 hierarchy)
function groupByInstanceThenBoss<T extends { item_boss_name: string, item_instance_name: string }>(items: T[]) {
  const instances = new Map<string, Map<string, T[]>>()
  for (const item of items) {
    const instance = item.item_instance_name || 'Instance'
    const boss = item.item_boss_name || 'Unknown boss'
    const bossMap = instances.get(instance) ?? new Map<string, T[]>()
    const bucket = bossMap.get(boss) ?? []
    bucket.push(item)
    bossMap.set(boss, bucket)
    instances.set(instance, bossMap)
  }
  return Array.from(instances, ([instance, bossMap]) => ({
    instance,
    bosses: Array.from(bossMap, ([boss, list]) => ({ boss, items: list }))
  }))
}
const activeAuctionGroups = computed(() => groupByInstanceThenBoss(activeAuctions.value))

// prebid catalog: every session loot item, grouped by boss (V1 parity)
const prebidInputs = reactive<Record<string, number | undefined>>({})
const selectedInstance = ref('')

// the instances covered by the catalog; a picker shows when there's more than one
const catalogInstances = computed(() => [...new Set(catalogItems.value.map(item => item.instance_name || 'Instance'))])
const showInstancePicker = computed(() => catalogInstances.value.length > 1)

watchEffect(() => {
  if (!catalogInstances.value.includes(selectedInstance.value)) {
    selectedInstance.value = catalogInstances.value[0] || ''
  }
})

const prebidCatalogGroups = computed(() => {
  const scoped = showInstancePicker.value
    ? catalogItems.value.filter(item => (item.instance_name || 'Instance') === selectedInstance.value)
    : catalogItems.value
  const groups = new Map<string, { boss: string, instance: string, items: Item[] }>()
  for (const item of scoped) {
    const boss = item.boss_name || 'Unknown boss'
    const group = groups.get(boss) ?? { boss, instance: item.instance_name || '', items: [] as Item[] }
    group.items.push(item)
    groups.set(boss, group)
  }
  return Array.from(groups.values())
})

function catalogKey(item: Item) {
  return item.wow_item_id ? `id:${item.wow_item_id}` : `name:${item.name}`
}
function catalogIcon(item: Item) {
  return item.icon_url || (item.wow_item_id ? `/api/v1/images?path=files/icons/${item.wow_item_id}.jpg` : '')
}
function prebidFor(item: Item) {
  return bidding.openPrebidForItem(item)
}
// a prebid with a real bidder (admin-seeded empty prebids don't count as "taken")
function hasActivePrebid(item: Item) {
  return !!prebidFor(item)?.current_winner_member_id
}
function isMyPrebid(item: Item) {
  const existing = prebidFor(item)
  return !!existing && bidding.isMine(existing.current_winner_member_id)
}
function prebidDefaultPrice(item: Item) {
  const existing = prebidFor(item)
  if (existing) return existing.next_min_bid
  return item.default_prebid_opening_price || item.default_min_bid || 1
}
async function submitCatalogPrebid(item: Item) {
  if (sessionEnded.value) return
  const key = catalogKey(item)
  const amount = prebidInputs[key] ?? prebidDefaultPrice(item)
  if (amount <= 0) return
  const existing = prebidFor(item)
  try {
    if (existing) {
      await bidding.placePrebidBid(existing.id, amount)
    } else {
      await bidding.createPlayerPrebid(sessionId.value, {
        item_name: item.name,
        item_id: item.wow_item_id,
        initial_price: amount
      })
    }
    prebidInputs[key] = undefined
  } catch {
    // store exposes the error
  }
}

const toast = useToast()
let outbidAudio: HTMLAudioElement | undefined
let newItemAudio: HTMLAudioElement | undefined

watch(lastOutbid, (v) => {
  if (v) {
    toast.add({ title: 'Outbid!', description: v.name, color: 'error', icon: 'i-lucide-bell-ring' })
    playOutbidSound()
  }
})

watch(lastNewItem, (v) => {
  if (v) {
    playNewItemSound()
  }
})

// re-attach Wowhead tooltips when the board / catalog links change (SPA)
watch([activeAuctions, openPrebids, catalogItems], () => {
  if (!import.meta.client) return
  nextTick(() => {
    const wh = (window as unknown as { $WowheadPower?: { refreshLinks?: () => void } }).$WowheadPower
    wh?.refreshLinks?.()
  })
})

const bidInputs = reactive<Record<string, number | undefined>>({})
const playerTab = ref<PlayerTab>('bid')
const sessionUnavailableModalOpen = ref(false)
const sessionEndedModalOpen = ref(false)
const selfBidModalOpen = ref(false)
const pendingSelfBid = ref<{ type: 'auction' | 'prebid', item: Auction | Prebid, amount: number } | null>(null)

const now = ref(Date.now())
let clock: ReturnType<typeof setInterval> | undefined
let poll: ReturnType<typeof setInterval> | undefined

watch(sessionUnavailable, (value) => {
  if (value) sessionUnavailableModalOpen.value = true
}, { immediate: true })

watch(sessionEnded, (value) => {
  if (value) sessionEndedModalOpen.value = true
}, { immediate: true })

onMounted(() => {
  outbidAudio = new Audio('/outbid-alert.mp3')
  outbidAudio.preload = 'auto'
  newItemAudio = new Audio('/new-item.mp3')
  newItemAudio.preload = 'auto'
  window.addEventListener('pointerdown', unlockAudio)
  window.addEventListener('keydown', unlockAudio)
  bidding.load(sessionId.value)
  bidding.loadSession(sessionId.value)
  bidding.loadMyMember(sessionId.value)
  bidding.loadMembers(sessionId.value)
  bidding.loadCatalog(sessionId.value)
  bidding.connect(sessionId.value)
  // timer auto-closes now arrive over SSE (scheduler publishes); just tick the clock
  clock = setInterval(() => (now.value = Date.now()), 1000)
  // safety-net: catch any updates a dropped SSE stream missed (patches in place)
  poll = setInterval(() => bidding.refresh(sessionId.value), 8000)
})

onBeforeUnmount(() => {
  if (clock) clearInterval(clock)
  if (poll) clearInterval(poll)
  window.removeEventListener('pointerdown', unlockAudio)
  window.removeEventListener('keydown', unlockAudio)
  if (outbidAudio) {
    outbidAudio.pause()
    outbidAudio = undefined
  }
  if (newItemAudio) {
    newItemAudio.pause()
    newItemAudio = undefined
  }
  bidding.disconnect()
})

function playOutbidSound() {
  if (!outbidAudio) return
  outbidAudio.currentTime = 0
  void outbidAudio.play().catch(() => {
    // browser may block audio until user interacts; toast still shows
  })
}

function playNewItemSound() {
  if (!newItemAudio) return
  newItemAudio.currentTime = 0
  void newItemAudio.play().catch(() => {
    // browser may block audio until user interacts
  })
}

// browsers block audio until a user gesture; prime the elements on the first
// interaction so later programmatic plays (over SSE) are allowed
function unlockAudio() {
  for (const audio of [outbidAudio, newItemAudio]) {
    void audio?.play().then(() => {
      audio?.pause()
      if (audio) audio.currentTime = 0
    }).catch(() => {})
  }
  window.removeEventListener('pointerdown', unlockAudio)
  window.removeEventListener('keydown', unlockAudio)
}

function secondsLeft(endsAt?: string | null) {
  if (!endsAt) return 0
  const endMs = new Date(endsAt).getTime()
  if (Number.isNaN(endMs)) return 0
  return Math.max(0, Math.floor((endMs - now.value) / 1000))
}

function countdown(endsAt?: string | null) {
  const total = secondsLeft(endsAt)
  if (total <= 0) return 'closing…'
  return formatCountdown(total)
}

function formatCountdown(total: number) {
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function iconUrl(item: Auction | Prebid) {
  return item.item_icon_url || (item.item_id ? `/api/v1/images?path=files/icons/${item.item_id}.jpg` : '')
}

async function bidAuction(item: Auction, amount: number) {
  if (sessionEnded.value) return
  if (amount < item.next_min_bid) return
  if (bidding.isMine(item.current_winner_member_id)) {
    pendingSelfBid.value = { type: 'auction', item, amount }
    selfBidModalOpen.value = true
    return
  }
  await submitAuctionBid(item, amount)
}

async function submitAuctionBid(item: Auction, amount: number) {
  try {
    await bidding.placeBid(item.id, amount)
    bidInputs[item.id] = undefined
  } catch {
    // store exposes the error
  }
}

async function submitPrebidBid(item: Prebid, amount: number) {
  try {
    await bidding.placePrebidBid(item.id, amount)
    bidInputs[item.id] = undefined
  } catch {
    // store exposes the error
  }
}

function canCustomBid(item: Auction | Prebid) {
  if (sessionEnded.value) return false
  const amount = bidInputs[item.id]
  return typeof amount === 'number' && amount >= item.next_min_bid
}

async function confirmSelfBid() {
  const pending = pendingSelfBid.value
  if (!pending) return
  selfBidModalOpen.value = false
  pendingSelfBid.value = null
  if (pending.type === 'auction') {
    await submitAuctionBid(pending.item as Auction, pending.amount)
  } else {
    await submitPrebidBid(pending.item as Prebid, pending.amount)
  }
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
      <div class="topbar-actions">
        <UButton
          color="primary"
          variant="soft"
          icon="i-lucide-trophy"
          label="Results"
          :to="`/play/results/${sessionId}`"
        />
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-arrow-left"
          label="Leave"
          to="/play"
        />
      </div>
    </header>

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
          class="player-boss-groups"
        >
          <section
            v-for="instanceGroup in activeAuctionGroups"
            :key="instanceGroup.instance"
            class="player-instance-group"
          >
            <h3 class="player-instance-head">
              {{ instanceGroup.instance }}
            </h3>
            <section
              v-for="group in instanceGroup.bosses"
              :key="group.boss"
              class="player-boss-group"
            >
              <header class="player-boss-head">
                <div class="player-boss-titles">
                  <h4>{{ group.boss }}</h4>
                </div>
                <span>{{ group.items.length }}</span>
              </header>
              <div class="player-card-list">
                <article
                  v-for="item in group.items"
                  :key="item.id"
                  class="auction-card"
                  :class="{ winning: bidding.isMine(item.current_winner_member_id), outbid: bidding.isOutbid(item.id) }"
                >
                  <div class="loot-cell">
                    <div class="item-icon">
                      <img
                        v-if="item.item_id"
                        :src="iconUrl(item)"
                        alt=""
                      >
                      <span v-else>?</span>
                    </div>
                    <div class="loot-text">
                      <div class="item-name">
                        <a
                          v-if="item.item_id"
                          class="item-name-main wowhead-item-link quality-item-name"
                          :class="itemQualityClass(item.item_quality)"
                          :href="wowheadItemUrl(item.item_id)"
                          target="_blank"
                          rel="noopener noreferrer"
                        >{{ item.item_name }}</a>
                        <span
                          v-else
                          class="item-name-main quality-item-name"
                          :class="itemQualityClass(item.item_quality)"
                        >{{ item.item_name }}</span>
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
                      class="min-button session-theme-button"
                      color="primary"
                      icon="i-lucide-gavel"
                      label="Min"
                      :loading="submitting"
                      :disabled="sessionEnded"
                      @click="bidAuction(item, item.next_min_bid)"
                    />
                    <label class="bid-input">
                      <span>Your Bid</span>
                      <UInput
                        v-model.number="bidInputs[item.id]"
                        type="number"
                        :min="item.next_min_bid"
                        :placeholder="String(item.next_min_bid)"
                        :disabled="sessionEnded"
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
            </section>
          </section>
        </div>
      </template>
      <template v-else>
        <div
          v-if="!catalogItems.length"
          class="player-empty"
        >
          No prebid items available for this session.
        </div>
        <div
          v-else
          class="prebid-catalog"
        >
          <div
            v-if="showInstancePicker"
            class="prebid-instance-picker"
          >
            <button
              v-for="instance in catalogInstances"
              :key="instance"
              type="button"
              class="prebid-filter-badge"
              :class="{ active: selectedInstance === instance }"
              @click="selectedInstance = instance"
            >
              {{ instance }}
            </button>
          </div>

          <section
            v-for="group in prebidCatalogGroups"
            :key="group.boss"
            class="player-boss-group"
          >
            <header class="player-boss-head">
              <div class="player-boss-titles">
                <small
                  v-if="group.instance && !showInstancePicker"
                  class="player-boss-instance"
                >{{ group.instance }}</small>
                <h4>{{ group.boss }}</h4>
              </div>
              <span>{{ group.items.length }}</span>
            </header>
            <div class="prebid-catalog-grid">
              <article
                v-for="item in group.items"
                :key="catalogKey(item)"
                class="prebid-catalog-card"
                :class="{ 'winning': isMyPrebid(item), 'has-prebid': hasActivePrebid(item) }"
              >
                <div class="prebid-catalog-icon">
                  <img
                    v-if="item.wow_item_id"
                    :src="catalogIcon(item)"
                    alt=""
                  >
                  <span v-else>?</span>
                </div>
                <div class="prebid-catalog-body">
                  <div class="prebid-catalog-name">
                    <a
                      v-if="item.wow_item_id"
                      class="item-name-main wowhead-item-link quality-item-name"
                      :class="itemQualityClass(item.quality)"
                      :href="wowheadItemUrl(item.wow_item_id)"
                      target="_blank"
                      rel="noopener noreferrer"
                    >{{ item.name }}</a>
                    <span
                      v-else
                      class="item-name-main quality-item-name"
                      :class="itemQualityClass(item.quality)"
                    >{{ item.name }}</span>
                    <span
                      v-if="isMyPrebid(item)"
                      class="bid-you-pill"
                    >
                      Leading
                    </span>
                  </div>
                  <div class="prebid-catalog-state">
                    <template v-if="prebidFor(item)?.current_winner_member_id">
                      <span class="prebid-open-badge">Prebid {{ prebidFor(item)?.current_bid }}</span>
                      <span class="prebid-catalog-by">{{ bidding.memberName(prebidFor(item)?.current_winner_member_id ?? '') }}</span>
                    </template>
                    <span
                      v-else
                      class="prebid-catalog-none"
                    >No prebid yet</span>
                  </div>
                  <div class="prebid-catalog-action">
                    <UInput
                      v-model.number="prebidInputs[catalogKey(item)]"
                      type="number"
                      size="sm"
                      :min="prebidDefaultPrice(item)"
                      :placeholder="String(prebidDefaultPrice(item))"
                      :disabled="sessionEnded"
                    />
                    <UButton
                      color="primary"
                      variant="solid"
                      size="sm"
                      block
                      class="justify-center session-theme-button"
                      :label="hasActivePrebid(item) ? 'Outbid' : 'Prebid'"
                      :loading="submitting"
                      :disabled="sessionEnded"
                      @click="submitCatalogPrebid(item)"
                    />
                  </div>
                </div>
              </article>
            </div>
          </section>
        </div>
      </template>
    </section>

    <UModal
      v-model:open="sessionUnavailableModalOpen"
      title="Session unavailable"
      :description="sessionUnavailable?.message || 'Session cannot be opened.'"
    >
      <template #footer>
        <div class="session-end-confirm-actions">
          <UButton
            color="warning"
            icon="i-lucide-arrow-left"
            label="Back to join"
            to="/play"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="sessionEndedModalOpen"
      title="Session ended"
      description="Bidding is closed. Open the Results page to see the final items."
    >
      <template #footer>
        <div class="session-end-confirm-actions">
          <UButton
            color="neutral"
            variant="outline"
            label="Close"
            @click="sessionEndedModalOpen = false"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="selfBidModalOpen"
      title="Confirm self bid"
      :description="pendingSelfBid?.type === 'auction' ? 'You are already winning this item. Bid against yourself anyway?' : 'You are already leading this prebid. Bid again anyway?'"
    >
      <template #footer>
        <div class="session-end-confirm-actions">
          <UButton
            color="neutral"
            variant="outline"
            label="Cancel"
            @click="selfBidModalOpen = false"
          />
          <UButton
            color="warning"
            label="Bid anyway"
            @click="confirmSelfBid"
          />
        </div>
      </template>
    </UModal>
  </main>
</template>
