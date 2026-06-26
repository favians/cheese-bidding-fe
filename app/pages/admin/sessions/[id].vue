<script setup lang="ts">
import type { Auction, CreateAuctionRequest, CreatePrebidRequest, Item, Prebid } from '#shared/types/api'

definePageMeta({ middleware: 'admin' })

type BoardTab = 'active' | 'prebid' | 'results'

const route = useRoute()
const sessionId = computed(() => String(route.params.id))
const store = useAdminSessionStore()
const catalog = useCatalogStore()
const { session, auctions, prebids, members, sessionInstances, loading, saving, error } = storeToRefs(store)
const { instances } = storeToRefs(catalog)

const showAuctionForm = ref(true)
const showPrebidForm = ref(false)
const boardTab = ref<BoardTab>('active')
const auctionForm = reactive<CreateAuctionRequest>({ item_name: '' })
const prebidForm = reactive<CreatePrebidRequest>({ item_name: '' })
const selectedAuctionItemName = ref('')
const selectedPrebidItemName = ref('')
const draftInstanceIds = ref<number[]>([])

const now = ref(Date.now())
let clock: ReturnType<typeof setInterval> | undefined
let poll: ReturnType<typeof setInterval> | undefined

const activeAuctions = computed(() => auctions.value.filter(item => item.status === 'active'))
const finishedAuctions = computed(() => auctions.value.filter(item => item.status !== 'active'))
const openPrebids = computed(() => prebids.value.filter(item => item.status === 'open'))
const resolvedPrebids = computed(() => prebids.value.filter(item => item.status !== 'open'))
const selectedInstances = computed(() => instances.value.filter(instance => draftInstanceIds.value.includes(instance.id)))
const allowedItemInstanceIds = computed(() => sessionInstances.value.map(instance => instance.id))
const totalSold = computed(() => finishedAuctions.value.reduce((sum, item) => sum + (item.status === 'closed' ? item.winning_bid : 0), 0))
const estimatedPayout = computed(() => {
  const playerCount = Math.max(session.value?.player_count ?? members.value.length ?? 0, 1)
  const cut = Math.max(0, Math.min(session.value?.management_cut_percent ?? 0, 100))
  return Math.floor((totalSold.value * (100 - cut)) / 100 / playerCount)
})
const boardRows = computed(() => {
  if (boardTab.value === 'prebid') return openPrebids.value
  if (boardTab.value === 'results') return finishedAuctions.value
  return activeAuctions.value
})
const joinURL = computed(() => {
  if (!import.meta.client) return ''
  return `${window.location.origin}/play`
})

onMounted(() => {
  store.load(sessionId.value)
  catalog.loadInstances()
  clock = setInterval(() => (now.value = Date.now()), 1000)
  poll = setInterval(() => store.refresh(sessionId.value), 2000)
})

onBeforeUnmount(() => {
  if (clock) clearInterval(clock)
  if (poll) clearInterval(poll)
})

watch(sessionInstances, (rows) => {
  draftInstanceIds.value = rows.map(instance => instance.id)
}, { immediate: true })

watch(() => auctionForm.item_name, (name) => {
  if (auctionForm.item_id && name !== selectedAuctionItemName.value) {
    auctionForm.item_id = undefined
    selectedAuctionItemName.value = ''
  }
})

watch(() => prebidForm.item_name, (name) => {
  if (prebidForm.item_id && name !== selectedPrebidItemName.value) {
    prebidForm.item_id = undefined
    selectedPrebidItemName.value = ''
  }
})

const memberName = (id: string) => {
  if (!id) return '—'
  return members.value.find(member => member.id === id)?.character_name ?? id
}

function countdown(endsAt: string) {
  const ms = new Date(endsAt).getTime() - now.value
  if (ms <= 0) return 'closing…'
  const total = Math.floor(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function iconUrl(item: Auction | Prebid) {
  return item.item_id ? `/icons/${item.item_id}.jpg` : ''
}

function onAuctionItem(item: Item) {
  auctionForm.item_name = item.name
  auctionForm.item_id = item.wow_item_id
  selectedAuctionItemName.value = item.name
}

function onPrebidItem(item: Item) {
  prebidForm.item_name = item.name
  prebidForm.item_id = item.wow_item_id
  selectedPrebidItemName.value = item.name
}

function toggleInstance(id: number) {
  if (draftInstanceIds.value.includes(id)) {
    draftInstanceIds.value = draftInstanceIds.value.filter(instanceID => instanceID !== id)
    return
  }
  draftInstanceIds.value = [...draftInstanceIds.value, id]
}

function isInstanceSelected(id: number) {
  return draftInstanceIds.value.includes(id)
}

async function saveInstances() {
  await store.saveInstances(sessionId.value, draftInstanceIds.value)
}

async function copyJoin() {
  if (!import.meta.client || !session.value) return
  await navigator.clipboard.writeText(`${joinURL.value}\nCode: ${session.value.code}`)
}

function resetAuctionForm() {
  Object.assign(auctionForm, { item_name: '' })
  delete auctionForm.item_id
  delete auctionForm.initial_buyer_name
  delete auctionForm.initial_price
  delete auctionForm.min_bid
  delete auctionForm.bid_increment
  delete auctionForm.timer_seconds
  selectedAuctionItemName.value = ''
}

function resetPrebidForm() {
  Object.assign(prebidForm, { item_name: '' })
  delete prebidForm.item_id
  delete prebidForm.initial_buyer_name
  delete prebidForm.initial_price
  delete prebidForm.quantity
  delete prebidForm.min_bid
  delete prebidForm.bid_increment
  selectedPrebidItemName.value = ''
}

async function submitAuction() {
  if (!auctionForm.item_name.trim()) return
  try {
    await store.createAuction(sessionId.value, { ...auctionForm })
    resetAuctionForm()
    boardTab.value = 'active'
  } catch {
    // store exposes error
  }
}

async function submitPrebid() {
  if (!prebidForm.item_name.trim()) return
  try {
    await store.createPrebid(sessionId.value, { ...prebidForm })
    resetPrebidForm()
    boardTab.value = 'prebid'
  } catch {
    // store exposes error
  }
}
</script>

<template>
  <main class="public-shell session-admin-shell">
    <header class="topbar session-topbar">
      <div class="brand">
        <div class="brand-head">
          <span class="brand-logo">🧀 Cheese GDKP</span>
          <UBadge
            :color="session?.status === 'active' ? 'success' : 'neutral'"
            variant="soft"
          >
            {{ session?.status || 'loading' }}
          </UBadge>
        </div>
        <h1>{{ session?.title || 'Session' }}</h1>
        <p>
          Code <span class="font-mono">{{ session?.code || '—' }}</span>
          · {{ members.length }} players
          · {{ selectedInstances.map(instance => instance.name).join(' + ') || 'All instances' }}
        </p>
      </div>
      <div class="session-topbar-actions">
        <UButton
          color="primary"
          variant="soft"
          icon="i-lucide-copy"
          label="Copy join"
          @click="copyJoin"
        />
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-arrow-left"
          label="Sessions"
          to="/admin"
        />
      </div>
    </header>

    <UAlert
      v-if="error"
      color="error"
      variant="soft"
      icon="i-lucide-circle-alert"
      :title="error"
      class="mb-4"
    />

    <div class="session-admin-grid">
      <aside class="session-admin-sidebar">
        <section class="session-panel session-summary-panel">
          <h2>{{ session?.title || 'Loading session…' }}</h2>
          <p
            v-if="session?.date_to"
            class="session-muted"
          >
            Raid Date: {{ session.date_to }}
          </p>
          <div class="session-join-code">
            <span>Join code</span>
            <strong>{{ session?.code || '—' }}</strong>
            <small>{{ joinURL }}</small>
          </div>
          <div class="session-metric-grid">
            <span>Total Sold <strong>{{ totalSold }}</strong></span>
            <span>Cut <strong>{{ session?.management_cut_percent ?? 0 }}%</strong></span>
            <span>Players <strong>{{ session?.player_count || members.length }}</strong></span>
            <span>Payout <strong>{{ estimatedPayout }}</strong></span>
          </div>
        </section>

        <section class="session-panel">
          <div class="session-panel-head">
            <h3>Raid Instances</h3>
            <UButton
              size="xs"
              color="primary"
              variant="soft"
              icon="i-lucide-save"
              label="Save"
              :loading="saving"
              @click="saveInstances"
            />
          </div>
          <div class="session-instance-picker">
            <button
              v-for="instance in instances"
              :key="instance.id"
              type="button"
              class="session-instance-choice"
              :class="{ 'is-selected': isInstanceSelected(instance.id) }"
              @click="toggleInstance(instance.id)"
            >
              <span>{{ instance.name }}</span>
              <small>{{ instance.expansion }}</small>
            </button>
          </div>
        </section>

        <section class="session-panel">
          <div class="session-panel-head">
            <h3>Start Item Bid</h3>
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              :icon="showAuctionForm ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
              @click="showAuctionForm = !showAuctionForm"
            />
          </div>
          <form
            v-if="showAuctionForm"
            class="session-form"
            @submit.prevent="submitAuction"
          >
            <UFormField
              label="Item Name"
              required
            >
              <UInput
                v-model="auctionForm.item_name"
                class="w-full"
                placeholder="Pick loot or type item name"
              />
            </UFormField>
            <ItemPicker
              :allowed-instance-ids="allowedItemInstanceIds"
              @select="onAuctionItem"
            />
            <div class="session-form-row">
              <UFormField label="Minimum Bid">
                <UInput
                  v-model.number="auctionForm.min_bid"
                  type="number"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Increment">
                <UInput
                  v-model.number="auctionForm.bid_increment"
                  type="number"
                  class="w-full"
                />
              </UFormField>
            </div>
            <UFormField label="Timer, seconds">
              <UInput
                v-model.number="auctionForm.timer_seconds"
                type="number"
                class="w-full"
              />
            </UFormField>
            <UButton
              type="submit"
              label="Start Auction"
              icon="i-lucide-gavel"
              block
              class="justify-center"
              :loading="saving"
            />
          </form>
        </section>

        <section class="session-panel">
          <div class="session-panel-head">
            <h3>Add Prebid Item</h3>
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              :icon="showPrebidForm ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
              @click="showPrebidForm = !showPrebidForm"
            />
          </div>
          <form
            v-if="showPrebidForm"
            class="session-form"
            @submit.prevent="submitPrebid"
          >
            <UFormField
              label="Item Name"
              required
            >
              <UInput
                v-model="prebidForm.item_name"
                class="w-full"
                placeholder="Pick loot or type item name"
              />
            </UFormField>
            <ItemPicker
              :allowed-instance-ids="allowedItemInstanceIds"
              @select="onPrebidItem"
            />
            <div class="session-form-row">
              <UFormField label="Initial Buyer">
                <UInput
                  v-model="prebidForm.initial_buyer_name"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Opening Price">
                <UInput
                  v-model.number="prebidForm.initial_price"
                  type="number"
                  class="w-full"
                />
              </UFormField>
            </div>
            <div class="session-form-row">
              <UFormField label="Increment">
                <UInput
                  v-model.number="prebidForm.bid_increment"
                  type="number"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Quantity">
                <UInput
                  v-model.number="prebidForm.quantity"
                  type="number"
                  class="w-full"
                />
              </UFormField>
            </div>
            <UButton
              type="submit"
              label="Add Prebid"
              icon="i-lucide-check"
              block
              class="justify-center"
              :loading="saving"
            />
          </form>
        </section>

        <section class="session-panel">
          <h3>Players Joined: {{ members.length }}</h3>
          <div class="session-member-list">
            <div
              v-for="member in members"
              :key="member.id"
              class="session-member-row"
            >
              <strong>{{ member.character_name }}</strong>
              <span>{{ member.discord_name || member.discord_id }}</span>
            </div>
            <p
              v-if="!members.length"
              class="session-muted"
            >
              No players yet.
            </p>
          </div>
        </section>
      </aside>

      <section class="session-board">
        <div class="session-board-head">
          <div class="session-board-tabs">
            <button
              type="button"
              :class="{ active: boardTab === 'active' }"
              @click="boardTab = 'active'"
            >
              Active <span>{{ activeAuctions.length }}</span>
            </button>
            <button
              type="button"
              :class="{ active: boardTab === 'prebid' }"
              @click="boardTab = 'prebid'"
            >
              Prebid <span>{{ openPrebids.length }}</span>
            </button>
            <button
              type="button"
              :class="{ active: boardTab === 'results' }"
              @click="boardTab = 'results'"
            >
              Finished <span>{{ finishedAuctions.length }}</span>
            </button>
          </div>
          <span v-if="boardTab === 'prebid'">{{ openPrebids.length }} open</span>
          <span v-else-if="boardTab === 'results'">{{ finishedAuctions.length }} finished</span>
          <span v-else>{{ activeAuctions.length }} live</span>
        </div>

        <div
          v-if="loading && !auctions.length && !prebids.length"
          class="session-empty"
        >
          Loading…
        </div>
        <div
          v-else-if="!boardRows.length"
          class="session-empty"
        >
          No {{ boardTab === 'active' ? 'active auctions' : boardTab === 'prebid' ? 'open prebids' : 'finished auctions' }}.
        </div>
        <div
          v-else
          class="session-card-list"
        >
          <article
            v-for="item in boardRows"
            :key="item.id"
            class="session-auction-card"
            :class="[
              item.status,
              boardTab === 'prebid' ? 'is-prebid' : ''
            ]"
          >
            <div class="session-loot-cell">
              <div class="session-item-icon">
                <img
                  v-if="item.item_id"
                  :src="iconUrl(item)"
                  alt=""
                >
                <span v-else>?</span>
              </div>
              <div class="session-loot-copy">
                <strong>{{ item.item_name }}</strong>
                <span>{{ 'bid_increment' in item ? `Increment ${item.bid_increment}` : '' }}</span>
              </div>
            </div>

            <div class="session-bid-state">
              <span>{{ boardTab === 'results' ? 'Final' : 'Current' }}</span>
              <strong>{{ item.current_bid || ('winning_bid' in item ? item.winning_bid : 0) || '—' }}</strong>
              <small>by {{ memberName(item.current_winner_member_id || ('winner_member_id' in item ? item.winner_member_id : '')) }}</small>
            </div>

            <div class="session-timer-cell">
              <strong v-if="'ends_at' in item && item.status === 'active'">{{ countdown(item.ends_at) }}</strong>
              <strong v-else>{{ item.status }}</strong>
              <span>{{ item.bid_count }} bids</span>
            </div>

            <div
              v-if="item.status === 'active'"
              class="session-card-actions"
            >
              <UButton
                size="xs"
                color="success"
                variant="soft"
                icon="i-lucide-check"
                label="Close"
                @click="store.auctionAction(item.id, 'close')"
              />
              <UButton
                size="xs"
                color="warning"
                variant="soft"
                icon="i-lucide-rotate-ccw"
                label="Reset"
                @click="store.auctionAction(item.id, 'reset')"
              />
              <UButton
                size="xs"
                color="error"
                variant="soft"
                icon="i-lucide-x"
                label="Cancel"
                @click="store.auctionAction(item.id, 'cancel')"
              />
            </div>
            <div
              v-else-if="item.status === 'open'"
              class="session-card-actions"
            >
              <UButton
                size="xs"
                color="primary"
                variant="soft"
                icon="i-lucide-arrow-up-right"
                label="Resolve"
                @click="store.prebidAction(item.id, 'resolve', sessionId)"
              />
              <UButton
                size="xs"
                color="error"
                variant="soft"
                icon="i-lucide-x"
                label="Cancel"
                @click="store.prebidAction(item.id, 'cancel', sessionId)"
              />
            </div>
            <div
              v-else
              class="session-card-result"
            >
              <span v-if="'winning_bid' in item && item.winning_bid">Sold {{ item.winning_bid }}</span>
              <span v-else>{{ item.status }}</span>
            </div>
          </article>
        </div>

        <div
          v-if="boardTab === 'prebid' && resolvedPrebids.length"
          class="session-resolved-block"
        >
          <div class="session-board-head is-subhead">
            <h3>Resolved Prebids</h3>
            <span>{{ resolvedPrebids.length }}</span>
          </div>
          <div class="session-card-list">
            <article
              v-for="item in resolvedPrebids"
              :key="item.id"
              class="session-auction-card is-prebid resolved"
            >
              <div class="session-loot-cell">
                <div class="session-item-icon">
                  <img
                    v-if="item.item_id"
                    :src="iconUrl(item)"
                    alt=""
                  >
                  <span v-else>?</span>
                </div>
                <div class="session-loot-copy">
                  <strong>{{ item.item_name }}</strong>
                  <span>{{ item.status }} · auction {{ item.auction_id || '—' }}</span>
                </div>
              </div>
              <div class="session-bid-state">
                <span>Top bid</span>
                <strong>{{ item.current_bid || '—' }}</strong>
                <small>by {{ memberName(item.current_winner_member_id) }}</small>
              </div>
              <div class="session-card-result">
                {{ item.status }}
              </div>
            </article>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>
