<script setup lang="ts">
import type { Auction, CreateAuctionRequest, CreatePrebidRequest, Item, Prebid, SessionAuctionResult } from '#shared/types/api'

definePageMeta({ middleware: 'admin' })

type BoardTab = 'active' | 'prebid' | 'results'
type PrebidAction = 'resolve' | 'cancel' | 'not-dropped' | 'delete-last-bid'

const route = useRoute()
const sessionId = computed(() => String(route.params.id))
const store = useAdminSessionStore()
const catalog = useCatalogStore()
const { session, auctions, prebids, members, sessionInstances, summary, loading, saving, error } = storeToRefs(store)
const { instances } = storeToRefs(catalog)

const showAuctionForm = ref(true)
const showPrebidForm = ref(false)
const boardTab = ref<BoardTab>('active')
const auctionForm = reactive<CreateAuctionRequest>({ item_name: '' })
const prebidForm = reactive<CreatePrebidRequest>({ item_name: '' })
const selectedAuctionItemName = ref('')
const selectedPrebidItemName = ref('')

const now = ref(Date.now())
let clock: ReturnType<typeof setInterval> | undefined
let poll: ReturnType<typeof setInterval> | undefined

const activeAuctions = computed(() => auctions.value.filter(item => item.status === 'active'))
const finishedAuctions = computed(() => auctions.value.filter(item => item.status !== 'active'))
const closedAuctions = computed(() => auctions.value.filter(item => item.status === 'closed'))
const cancelledAuctions = computed(() => auctions.value.filter(item => item.status === 'cancelled'))
const openPrebids = computed(() => prebids.value.filter(item => item.status === 'open'))
const resolvedPrebids = computed(() => prebids.value.filter(item => item.status !== 'open'))
const allowedItemInstanceIds = computed(() => sessionInstances.value.map(instance => instance.id))
const selectedInstances = computed(() => instances.value.filter(instance => allowedItemInstanceIds.value.includes(instance.id)))
const isSessionEnded = computed(() => session.value?.status === 'ended')
const summaryStats = computed(() => summary.value?.stats ?? null)
const summaryAuctionResults = computed(() => summary.value?.auction_results ?? [])
const resultAuctionRows = computed(() => summaryAuctionResults.value.length ? summaryAuctionResults.value : finishedAuctions.value.map(toSummaryAuctionResult))
const totalSold = computed(() => summaryStats.value?.total_winning_bid ?? closedAuctions.value.reduce((sum, item) => sum + item.winning_bid, 0))
const estimatedPayout = computed(() => {
  if (summary.value) return summary.value.estimated_payout_each
  const playerCount = Math.max(session.value?.player_count ?? members.value.length ?? 0, 1)
  const cut = Math.max(0, Math.min(session.value?.management_cut_percent ?? 0, 100))
  return Math.floor((totalSold.value * (100 - cut)) / 100 / playerCount)
})
const managementCutAmount = computed(() => {
  if (summary.value) return summary.value.management_cut_amount
  const cut = Math.max(0, Math.min(session.value?.management_cut_percent ?? 0, 100))
  return Math.floor((totalSold.value * cut) / 100)
})
const resultSoldCount = computed(() => summaryStats.value?.sold_count ?? closedAuctions.value.length)
const resultCancelledCount = computed(() => summaryStats.value?.cancelled_count ?? cancelledAuctions.value.length)
const resultPlayerCount = computed(() => summaryStats.value?.player_count ?? session.value?.player_count ?? members.value.length)
const resultSpendRows = computed(() => {
  if (summary.value) {
    return summary.value.player_spends.map(row => ({
      member_id: row.member_id,
      name: row.character_name || row.discord_name || row.discord_id || row.member_id,
      total: row.total_spent,
      items: row.item_count
    }))
  }
  const rows = new Map<string, { member_id: string, name: string, total: number, items: number }>()
  for (const auction of closedAuctions.value) {
    const memberID = auction.winner_member_id || auction.current_winner_member_id
    if (!memberID) continue
    const current = rows.get(memberID) ?? {
      member_id: memberID,
      name: memberName(memberID),
      total: 0,
      items: 0
    }
    current.total += auction.winning_bid || auction.current_bid || 0
    current.items += 1
    rows.set(memberID, current)
  }
  return [...rows.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
})
const resultSummaryText = computed(() => {
  const lines = [
    `${session.value?.title || 'Session'} — ${session.value?.code || ''}`,
    `Total sold: ${totalSold.value}`,
    `Management cut (${session.value?.management_cut_percent ?? 0}%): ${managementCutAmount.value}`,
    `Estimated payout/player: ${estimatedPayout.value}`,
    '',
    'Winners:'
  ]
  if (!resultAuctionRows.value.filter(row => row.status === 'closed').length) {
    lines.push('- No closed auctions yet')
  } else {
    for (const auction of resultAuctionRows.value.filter(row => row.status === 'closed')) {
      lines.push(`- ${auction.item_name}: ${auction.winning_bid} — ${summaryWinnerName(auction)}`)
    }
  }
  if (resultCancelledCount.value || openPrebids.value.length) {
    lines.push('')
    lines.push(`Unresolved: ${resultCancelledCount.value} cancelled auctions, ${openPrebids.value.length} open prebids`)
  }
  return lines.join('\n')
})
const boardRows = computed(() => {
  if (boardTab.value === 'prebid') return openPrebids.value
  if (boardTab.value === 'results') return finishedAuctions.value
  return activeAuctions.value
})
const joinURL = computed(() => {
  if (!import.meta.client || !session.value?.code) return ''
  const url = new URL('/play', window.location.origin)
  url.searchParams.set('code', session.value.code)
  return url.toString()
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

function toSummaryAuctionResult(auction: Auction): SessionAuctionResult {
  const winnerMemberID = auction.winner_member_id || auction.current_winner_member_id
  const member = members.value.find(row => row.id === winnerMemberID)
  return {
    auction_id: auction.id,
    item_name: auction.item_name,
    item_id: auction.item_id,
    status: auction.status,
    winning_bid: auction.winning_bid || auction.current_bid || 0,
    winner_member_id: winnerMemberID,
    discord_id: member?.discord_id ?? '',
    discord_name: member?.discord_name ?? '',
    character_name: member?.character_name ?? '',
    class_name: member?.class_name ?? '',
    initial_buyer_name: auction.initial_buyer_name,
    initial_price: auction.initial_price,
    closed_at: auction.closed_at
  }
}

function summaryWinnerName(row: SessionAuctionResult) {
  return row.character_name || row.discord_name || row.discord_id || row.winner_member_id || '—'
}

function countdown(endsAt?: string | null) {
  if (!endsAt) return 'closing…'
  const endMs = new Date(endsAt).getTime()
  if (Number.isNaN(endMs)) return 'closing…'
  const ms = endMs - now.value
  if (ms <= 0) return 'closing…'
  const total = Math.floor(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function iconUrl(item: Auction | Prebid) {
  return item.item_icon_url || (item.item_id ? `/api/v1/images?path=files/icons/${item.item_id}.jpg` : '')
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

async function copyJoin() {
  if (!import.meta.client || !session.value) return
  await navigator.clipboard.writeText(joinURL.value)
}

async function copyResultSummary() {
  if (!import.meta.client) return
  await navigator.clipboard.writeText(resultSummaryText.value)
}

function exportResultCSV() {
  if (!import.meta.client) return
  const rows = [
    ['Item', 'Winner', 'Amount', 'Status'],
    ...resultAuctionRows.value.map(auction => [
      auction.item_name,
      summaryWinnerName(auction),
      String(auction.winning_bid || 0),
      auction.status
    ])
  ]
  const csv = rows.map(row => row.map(csvCell).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${session.value?.code || 'session'}-results.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`
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
  if (isSessionEnded.value) return
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
  if (isSessionEnded.value) return
  if (!prebidForm.item_name.trim()) return
  try {
    await store.createPrebid(sessionId.value, { ...prebidForm })
    resetPrebidForm()
    boardTab.value = 'prebid'
  } catch {
    // store exposes error
  }
}

function auctionActionMessage(item: Auction, action: 'close' | 'cancel' | 'reset') {
  if (item.status === 'closed' && item.winning_bid > 0 && (action === 'cancel' || action === 'reset')) {
    const verb = action === 'cancel' ? 'cancel this closed auction' : 'reset this closed auction'
    return `This will ${verb} and refund ${item.winning_bid} to ${memberName(item.winner_member_id)}. Continue?`
  }
  if (action === 'reset') {
    return `Reset bids for ${item.item_name}? Current bid history will be cleared.`
  }
  if (action === 'cancel') {
    return `Cancel auction for ${item.item_name}?`
  }
  return `Close auction for ${item.item_name}? Winner will be charged when there is a winning bid.`
}

async function runAuctionAction(item: Auction, action: 'close' | 'cancel' | 'reset') {
  if (isSessionEnded.value && (action === 'close' || action === 'reset')) return
  if (import.meta.client && !window.confirm(auctionActionMessage(item, action))) {
    return
  }
  await store.auctionAction(item.id, action)
}

function prebidActionMessage(item: Prebid, action: PrebidAction) {
  if (action === 'resolve') {
    return `Start live auction from ${item.item_name}?\n\nCurrent top prebid becomes the opening bid.`
  }
  if (action === 'delete-last-bid') {
    return `Delete latest prebid for ${item.item_name}?\n\nOnly the newest prebid will be removed.`
  }
  if (action === 'not-dropped') {
    return `Mark ${item.item_name} as not dropped?`
  }
  return `Cancel prebid for ${item.item_name}?`
}

async function runPrebidAction(item: Prebid, action: PrebidAction) {
  if (isSessionEnded.value && action !== 'cancel') return
  if (action === 'delete-last-bid' && item.bid_count <= 1) {
    return
  }
  if (import.meta.client && !window.confirm(prebidActionMessage(item, action))) {
    return
  }
  await store.prebidAction(item.id, action, sessionId.value)
}
</script>

<template>
  <main class="public-shell session-admin-shell">
    <AdminNav
      :title="session?.title || 'Session'"
      :subtitle="`Code ${session?.code || '—'} · ${members.length} players · ${selectedInstances.map(instance => instance.name).join(' + ') || 'All instances'} · ${session?.status || 'loading'}`"
    >
      <template #actions>
        <UBadge
          :color="session?.status === 'active' ? 'success' : 'neutral'"
          variant="soft"
        >
          {{ session?.status || 'loading' }}
        </UBadge>
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
      </template>
    </AdminNav>

    <UAlert
      v-if="error"
      color="error"
      variant="soft"
      icon="i-lucide-circle-alert"
      :title="error"
      class="mb-4"
    />
    <UAlert
      v-if="isSessionEnded"
      color="neutral"
      variant="soft"
      icon="i-lucide-flag"
      title="Session ended"
      description="New auctions, live closes, and reset-to-active actions are disabled. Cancel closed auctions when refund cleanup is needed."
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
            <h3>Start Item Bid</h3>
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              :icon="showAuctionForm ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
              :disabled="isSessionEnded"
              @click="showAuctionForm = !showAuctionForm"
            />
          </div>
          <p
            v-if="isSessionEnded"
            class="session-muted"
          >
            Session ended. New auctions are disabled.
          </p>
          <form
            v-else-if="showAuctionForm"
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
              :disabled="isSessionEnded"
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
              :disabled="isSessionEnded"
              @click="showPrebidForm = !showPrebidForm"
            />
          </div>
          <p
            v-if="isSessionEnded"
            class="session-muted"
          >
            Session ended. New prebids are disabled.
          </p>
          <form
            v-else-if="showPrebidForm"
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
              :disabled="isSessionEnded"
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

        <section
          v-if="boardTab === 'results'"
          class="session-results-summary"
        >
          <div class="session-results-actions">
            <div>
              <h3>Finished Session Summary</h3>
              <span>{{ resultSoldCount }} sold · {{ resultCancelledCount }} cancelled · {{ openPrebids.length }} open prebids</span>
            </div>
            <div class="session-results-buttons">
              <UButton
                size="xs"
                color="primary"
                variant="soft"
                icon="i-lucide-copy"
                label="Copy Discord"
                @click="copyResultSummary"
              />
              <UButton
                size="xs"
                color="neutral"
                variant="soft"
                icon="i-lucide-file-down"
                label="CSV"
                @click="exportResultCSV"
              />
            </div>
          </div>

          <div class="session-results-metrics">
            <article>
              <span>Total sold</span>
              <strong>{{ totalSold }}</strong>
            </article>
            <article>
              <span>Management cut</span>
              <strong>{{ managementCutAmount }}</strong>
            </article>
            <article>
              <span>Est. payout/player</span>
              <strong>{{ estimatedPayout }}</strong>
            </article>
            <article>
              <span>Players</span>
              <strong>{{ resultPlayerCount }}</strong>
            </article>
          </div>

          <div class="session-results-spend">
            <h4>Per-player spend</h4>
            <div
              v-if="!resultSpendRows.length"
              class="session-muted"
            >
              No winning spend yet.
            </div>
            <div
              v-for="row in resultSpendRows"
              :key="row.member_id"
              class="session-results-spend-row"
            >
              <span>{{ row.name }}</span>
              <small>{{ row.items }} item{{ row.items === 1 ? '' : 's' }}</small>
              <strong>{{ row.total }}</strong>
            </div>
          </div>
        </section>

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
                :disabled="isSessionEnded"
                @click="runAuctionAction(item, 'close')"
              />
              <UButton
                size="xs"
                color="warning"
                variant="soft"
                icon="i-lucide-rotate-ccw"
                label="Reset"
                :disabled="isSessionEnded"
                @click="runAuctionAction(item, 'reset')"
              />
              <UButton
                size="xs"
                color="error"
                variant="soft"
                icon="i-lucide-x"
                label="Cancel"
                @click="runAuctionAction(item, 'cancel')"
              />
            </div>
            <div
              v-else-if="item.status === 'open'"
              class="session-card-actions"
            >
              <UTooltip text="Start live auction">
                <UButton
                  size="xs"
                  color="primary"
                  variant="soft"
                  icon="i-lucide-play"
                  aria-label="Start live auction"
                  class="session-card-icon-button"
                  :disabled="isSessionEnded"
                  @click="runPrebidAction(item, 'resolve')"
                />
              </UTooltip>
              <UTooltip :text="item.bid_count > 1 ? 'Delete latest prebid' : 'Need at least 2 prebids'">
                <UButton
                  size="xs"
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-list-x"
                  aria-label="Delete latest prebid"
                  class="session-card-icon-button"
                  :disabled="isSessionEnded || item.bid_count <= 1"
                  @click="runPrebidAction(item, 'delete-last-bid')"
                />
              </UTooltip>
              <UTooltip text="Mark not dropped">
                <UButton
                  size="xs"
                  color="warning"
                  variant="soft"
                  icon="i-lucide-package-x"
                  aria-label="Mark not dropped"
                  class="session-card-icon-button"
                  :disabled="isSessionEnded"
                  @click="runPrebidAction(item, 'not-dropped')"
                />
              </UTooltip>
              <UTooltip text="Cancel prebid">
                <UButton
                  size="xs"
                  color="error"
                  variant="soft"
                  icon="i-lucide-trash-2"
                  aria-label="Cancel prebid"
                  class="session-card-icon-button"
                  @click="runPrebidAction(item, 'cancel')"
                />
              </UTooltip>
            </div>
            <div
              v-else
              class="session-card-result"
            >
              <span v-if="'winning_bid' in item && item.winning_bid">Sold {{ item.winning_bid }}</span>
              <small v-if="'winner_member_id' in item && item.winner_member_id">to {{ memberName(item.winner_member_id) }}</small>
              <span v-else>{{ item.status }}</span>
              <div
                v-if="item.status === 'closed'"
                class="session-card-result-actions"
              >
                <UButton
                  size="xs"
                  color="warning"
                  variant="soft"
                  icon="i-lucide-rotate-ccw"
                  label="Reset + refund"
                  :disabled="isSessionEnded"
                  @click="runAuctionAction(item, 'reset')"
                />
                <UButton
                  size="xs"
                  color="error"
                  variant="soft"
                  icon="i-lucide-x"
                  label="Cancel + refund"
                  @click="runAuctionAction(item, 'cancel')"
                />
              </div>
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
