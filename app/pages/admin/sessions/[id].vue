<script setup lang="ts">
import type { CreateAuctionRequest, CreatePrebidRequest } from '#shared/types/api'

definePageMeta({ middleware: 'admin' })

const route = useRoute()
const sessionId = computed(() => String(route.params.id))
const store = useAdminSessionStore()
const { session, auctions, prebids, members, loading, saving, error } = storeToRefs(store)

const showAuctionForm = ref(false)
const showPrebidForm = ref(false)
const auctionForm = reactive<CreateAuctionRequest>({ item_name: '' })
const prebidForm = reactive<CreatePrebidRequest>({ item_name: '' })

const now = ref(Date.now())
let clock: ReturnType<typeof setInterval> | undefined
let poll: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  store.load(sessionId.value)
  clock = setInterval(() => (now.value = Date.now()), 1000)
  // admin is not a session member, so it polls instead of using the client SSE
  poll = setInterval(() => store.refresh(sessionId.value), 2000)
})

onBeforeUnmount(() => {
  if (clock) clearInterval(clock)
  if (poll) clearInterval(poll)
})

const memberName = (id: string) => {
  if (!id) return '—'
  return members.value.find(m => m.id === id)?.character_name ?? id
}

function countdown(endsAt: string) {
  const ms = new Date(endsAt).getTime() - now.value
  if (ms <= 0) return 'closing…'
  const total = Math.floor(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

async function submitAuction() {
  if (!auctionForm.item_name.trim()) return
  try {
    await store.createAuction(sessionId.value, { ...auctionForm })
    auctionForm.item_name = ''
    showAuctionForm.value = false
  } catch {
    // store exposes error
  }
}

async function submitPrebid() {
  if (!prebidForm.item_name.trim()) return
  try {
    await store.createPrebid(sessionId.value, { ...prebidForm })
    prebidForm.item_name = ''
    showPrebidForm.value = false
  } catch {
    // store exposes error
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
        <h1>{{ session?.title || 'Session' }}</h1>
        <p>
          Code <span class="font-mono">{{ session?.code }}</span>
          · {{ session?.status }}
          · {{ members.length }} members
        </p>
      </div>
      <UButton
        color="neutral"
        variant="ghost"
        icon="i-lucide-arrow-left"
        label="Sessions"
        to="/admin"
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

    <!-- Auctions -->
    <section class="mb-8">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-lg font-semibold">
          Auctions
        </h2>
        <UButton
          size="sm"
          icon="i-lucide-plus"
          label="Open auction"
          @click="showAuctionForm = !showAuctionForm"
        />
      </div>

      <UCard
        v-if="showAuctionForm"
        class="public-login-card mb-4"
      >
        <form
          class="login-form"
          @submit.prevent="submitAuction"
        >
          <UFormField
            label="Item name"
            required
          >
            <UInput
              v-model="auctionForm.item_name"
              class="w-full"
              placeholder="e.g. Atiesh"
            />
          </UFormField>
          <div class="grid grid-cols-3 gap-3">
            <UFormField label="Min bid">
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
            <UFormField label="Timer (s)">
              <UInput
                v-model.number="auctionForm.timer_seconds"
                type="number"
                class="w-full"
              />
            </UFormField>
          </div>
          <UButton
            type="submit"
            label="Open"
            icon="i-lucide-gavel"
            block
            class="justify-center"
            :loading="saving"
          />
        </form>
      </UCard>

      <div
        v-if="loading && !auctions.length"
        class="py-6 text-center opacity-70"
      >
        Loading…
      </div>
      <div
        v-else-if="!auctions.length"
        class="py-6 text-center opacity-70"
      >
        No auctions yet.
      </div>
      <div
        v-else
        class="grid gap-3"
      >
        <UCard
          v-for="item in auctions"
          :key="item.id"
          class="profile-hero-card"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div class="flex items-center gap-2">
                <strong class="text-lg">{{ item.item_name }}</strong>
                <UBadge
                  :color="item.status === 'active' ? 'success' : 'neutral'"
                  variant="soft"
                >
                  {{ item.status }}
                </UBadge>
                <UBadge
                  v-if="item.status === 'active'"
                  color="warning"
                  variant="soft"
                  icon="i-lucide-timer"
                >
                  {{ countdown(item.ends_at) }}
                </UBadge>
              </div>
              <div class="mt-1 text-sm opacity-80">
                Bid <strong>{{ item.current_bid || '—' }}</strong>
                by {{ memberName(item.current_winner_member_id) }}
                · next min {{ item.next_min_bid }}
                · {{ item.bid_count }} bids
              </div>
            </div>
            <div
              v-if="item.status === 'active'"
              class="flex gap-2"
            >
              <UButton
                size="sm"
                color="success"
                variant="soft"
                icon="i-lucide-check"
                label="Close"
                @click="store.auctionAction(item.id, 'close')"
              />
              <UButton
                size="sm"
                color="warning"
                variant="soft"
                icon="i-lucide-rotate-ccw"
                label="Reset"
                @click="store.auctionAction(item.id, 'reset')"
              />
              <UButton
                size="sm"
                color="error"
                variant="soft"
                icon="i-lucide-x"
                label="Cancel"
                @click="store.auctionAction(item.id, 'cancel')"
              />
            </div>
          </div>
        </UCard>
      </div>
    </section>

    <!-- Prebids -->
    <section>
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-lg font-semibold">
          Prebids
        </h2>
        <UButton
          size="sm"
          icon="i-lucide-plus"
          label="Add prebid"
          @click="showPrebidForm = !showPrebidForm"
        />
      </div>

      <UCard
        v-if="showPrebidForm"
        class="public-login-card mb-4"
      >
        <form
          class="login-form"
          @submit.prevent="submitPrebid"
        >
          <UFormField
            label="Item name"
            required
          >
            <UInput
              v-model="prebidForm.item_name"
              class="w-full"
              placeholder="e.g. Sulfuras"
            />
          </UFormField>
          <div class="grid grid-cols-3 gap-3">
            <UFormField label="Min bid">
              <UInput
                v-model.number="prebidForm.min_bid"
                type="number"
                class="w-full"
              />
            </UFormField>
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
            label="Create prebid"
            icon="i-lucide-check"
            block
            class="justify-center"
            :loading="saving"
          />
        </form>
      </UCard>

      <div
        v-if="!prebids.length"
        class="py-6 text-center opacity-70"
      >
        No prebids.
      </div>
      <div
        v-else
        class="grid gap-3"
      >
        <UCard
          v-for="item in prebids"
          :key="item.id"
          class="profile-hero-card"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div class="flex items-center gap-2">
                <strong class="text-lg">{{ item.item_name }}</strong>
                <UBadge
                  :color="item.status === 'open' ? 'primary' : 'neutral'"
                  variant="soft"
                >
                  {{ item.status }}
                </UBadge>
              </div>
              <div class="mt-1 text-sm opacity-80">
                Bid <strong>{{ item.current_bid || '—' }}</strong>
                by {{ memberName(item.current_winner_member_id) }}
                · next min {{ item.next_min_bid }}
                · {{ item.bid_count }} bids
              </div>
            </div>
            <div
              v-if="item.status === 'open'"
              class="flex gap-2"
            >
              <UButton
                size="sm"
                color="primary"
                variant="soft"
                icon="i-lucide-arrow-up-right"
                label="Resolve"
                @click="store.prebidAction(item.id, 'resolve', sessionId)"
              />
              <UButton
                size="sm"
                color="error"
                variant="soft"
                icon="i-lucide-x"
                label="Cancel"
                @click="store.prebidAction(item.id, 'cancel', sessionId)"
              />
            </div>
          </div>
        </UCard>
      </div>
    </section>
  </main>
</template>
