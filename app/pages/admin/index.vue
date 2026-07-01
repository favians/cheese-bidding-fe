<script setup lang="ts">
import type { Session } from '#shared/types/api'

definePageMeta({ middleware: 'admin' })

const sessionsStore = useSessionsStore()
const { sessions, pagination, loading, error } = storeToRefs(sessionsStore)
const toast = useToast()
const endModalOpen = ref(false)
const endTarget = ref<Session | null>(null)

function loadSessions(page = pagination.value?.page ?? 1) {
  return sessionsStore.load({ page })
}

const sessionColumns = [
  { key: 'title', label: 'Session' },
  { key: 'status', label: 'Status' },
  { key: 'bid_currency', label: 'Currency' },
  { key: 'bid', label: 'Bid' },
  { key: 'default_timer_seconds', label: 'Timer' },
  { key: 'player_count', label: 'Players' },
  { key: 'actions', label: 'Actions' }
]

onMounted(() => loadSessions(1))

function formatDateTime(value?: string | null) {
  if (!value) {
    return '—'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

function sessionSubtitle(row: Session) {
  return [
    row.code,
    formatDateTime(row.created_at),
    row.date_to || '—'
  ].join(' · ')
}

function sessionRowKey(row: Session) {
  return row.id
}

async function openSession(row: Session) {
  await navigateTo(`/admin/sessions/${row.id}`)
}

async function copySession(row: Session) {
  if (!import.meta.client || !row.code) {
    return
  }
  const url = new URL('/play', window.location.origin)
  url.searchParams.set('code', row.code)
  try {
    await navigator.clipboard.writeText(url.toString())
    toast.add({
      title: 'Session copied',
      description: `${row.code} copied to clipboard`,
      color: 'success',
      icon: 'i-lucide-copy-check'
    })
  } catch {
    toast.add({
      title: 'Copy failed',
      description: 'Could not write session link to clipboard',
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  }
}

function requestEndSession(row: Session) {
  endTarget.value = row
  endModalOpen.value = true
}

async function confirmEndSession() {
  if (!endTarget.value) return
  try {
    const target = endTarget.value
    await sessionsStore.end(target.id)
    endModalOpen.value = false
    endTarget.value = null
    toast.add({
      title: 'Session ended',
      description: `${target.code} is now closed`,
      color: 'success',
      icon: 'i-lucide-circle-check'
    })
  } catch {
    // store exposes error
  }
}
</script>

<template>
  <main class="public-shell">
    <AdminNav title="Sessions" />

    <div
      v-if="loading && !sessions.length"
      class="py-10 text-center opacity-70"
    >
      Loading…
    </div>
    <div
      v-else-if="!sessions.length"
      class="session-empty"
    >
      <p>No sessions yet.</p>
      <UButton
        color="primary"
        icon="i-lucide-plus"
        label="New session"
        class="admin-data-table-primary-action"
        to="/admin/sessions/new"
      />
    </div>
    <div
      v-else
      class="session-list-table"
    >
      <AdminDataTable
        :columns="sessionColumns"
        :rows="sessions"
        :row-key="sessionRowKey"
        clickable-rows
        @row-click="openSession"
      >
        <template #header>
          <div class="admin-data-table-heading">
            <div>
              <strong>Session list</strong>
              <span>{{ sessions.length }} sessions</span>
            </div>
            <UButton
              color="primary"
              icon="i-lucide-plus"
              label="New session"
              class="admin-data-table-primary-action"
              to="/admin/sessions/new"
            />
          </div>
        </template>
        <template #cell-title="{ row }">
          <div class="session-list-title">
            <strong>{{ row.title }}</strong>
            <span>{{ sessionSubtitle(row) }}</span>
          </div>
        </template>
        <template #cell-status="{ row }">
          <UBadge
            :color="row.status === 'active' ? 'success' : 'neutral'"
            variant="soft"
          >
            {{ row.status }}
          </UBadge>
        </template>
        <template #cell-bid_currency="{ row }">
          <span class="session-list-cap">{{ row.bid_currency }}</span>
        </template>
        <template #cell-bid="{ row }">
          <div class="session-list-stat">
            <strong>{{ row.default_min_bid }}</strong>
            <span>+{{ row.default_bid_increment }}</span>
          </div>
        </template>
        <template #cell-default_timer_seconds="{ row }">
          {{ row.default_timer_seconds }}s
        </template>
        <template #cell-actions="{ row }">
          <div class="session-list-actions">
            <UTooltip text="Copy session">
              <UButton
                color="neutral"
                variant="soft"
                icon="i-lucide-copy"
                aria-label="Copy session"
                class="session-list-action-button"
                @click.stop="copySession(row)"
              />
            </UTooltip>
            <UTooltip
              v-if="row.status === 'active'"
              text="End session"
            >
              <UButton
                color="error"
                variant="soft"
                icon="i-lucide-square"
                aria-label="End session"
                class="session-list-action-button"
                @click.stop="requestEndSession(row)"
              />
            </UTooltip>
          </div>
        </template>
      </AdminDataTable>

      <AdminPagination
        :pagination="pagination"
        :loading="loading"
        @change="loadSessions"
      />
    </div>

    <UModal
      v-model:open="endModalOpen"
      title="End session"
      description="This closes the session and prevents more bidding."
    >
      <template #body>
        <p class="session-end-confirm-copy">
          End {{ endTarget?.title || 'this session' }}?
        </p>
        <p class="session-end-confirm-meta">
          Code {{ endTarget?.code || '—' }}
        </p>
      </template>
      <template #footer>
        <div class="session-end-confirm-actions">
          <UButton
            label="Cancel"
            color="neutral"
            variant="outline"
            @click="endModalOpen = false"
          />
          <UButton
            label="End session"
            color="error"
            :loading="loading"
            @click="confirmEndSession"
          />
        </div>
      </template>
    </UModal>
  </main>
</template>
