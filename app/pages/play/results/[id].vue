<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const route = useRoute()
const sessionId = computed(() => String(route.params.id))
const bidding = useBiddingStore()
const { closedAuctions, sessionInfo, loading } = storeToRefs(bidding)

// reflect the session's raid theme onto the page (V1 parity)
useInstanceTheme(() => sessionInfo.value?.title)

onMounted(() => {
  bidding.load(sessionId.value)
  bidding.loadSession(sessionId.value)
  bidding.loadMyMember(sessionId.value)
  bidding.loadMembers(sessionId.value)
})
</script>

<template>
  <main class="public-shell live-session-shell">
    <header class="topbar">
      <div class="brand">
        <div class="brand-head">
          <span class="brand-logo">🧀 Cheese GDKP</span>
        </div>
        <h1>Results</h1>
        <p>{{ sessionInfo?.title || 'Session' }} <span class="font-mono">{{ sessionInfo?.code || sessionId }}</span></p>
      </div>
      <UButton
        color="primary"
        variant="soft"
        icon="i-lucide-gavel"
        label="Back to bidding"
        :to="`/play/${sessionId}`"
      />
    </header>

    <section class="player-board results-board">
      <div class="player-board-head">
        <h2>Results</h2>
        <span>{{ closedAuctions.length }} finished</span>
      </div>
      <div
        v-if="loading && !closedAuctions.length"
        class="player-empty"
      >
        Loading…
      </div>
      <div
        v-else-if="!closedAuctions.length"
        class="player-empty"
      >
        No finished items yet.
      </div>
      <div
        v-else
        class="player-result-list"
      >
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
