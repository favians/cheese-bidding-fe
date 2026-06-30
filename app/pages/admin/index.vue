<script setup lang="ts">
import type { CreateSessionRequest, Session } from '#shared/types/api'

definePageMeta({ middleware: 'admin' })

const sessionsStore = useSessionsStore()
const catalog = useCatalogStore()
const { sessions, loading, saving, error } = storeToRefs(sessionsStore)
const { instances } = storeToRefs(catalog)

function defaultRaidDate() {
  const date = new Date()
  date.setDate(date.getDate() - 1)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const showCreate = ref(false)
const form = reactive<CreateSessionRequest>({
  title: '',
  bid_currency: 'dollar',
  default_min_bid: 100,
  default_bid_increment: 1,
  default_timer_seconds: 5400,
  date_to: defaultRaidDate()
})
const selectedInstanceIds = ref<number[]>([])
const sessionFaction = ref<'Alliance' | 'Horde'>('Alliance')
const factionOptions = ['Alliance', 'Horde']
const sessionColumns = [
  { key: 'title', label: 'Session' },
  { key: 'status', label: 'Status' },
  { key: 'bid_currency', label: 'Currency' },
  { key: 'bid', label: 'Bid' },
  { key: 'default_timer_seconds', label: 'Timer' },
  { key: 'player_count', label: 'Players' },
  { key: 'actions', label: 'Actions' }
]

const selectedInstances = computed(() => instances.value.filter(instance => selectedInstanceIds.value.includes(instance.id)))

onMounted(() => {
  sessionsStore.load()
  catalog.loadInstances()
  updatePrebuiltTitle()
})

watch([selectedInstanceIds, sessionFaction, () => form.date_to], updatePrebuiltTitle)

function formatPrebuiltDate(value?: string | null) {
  if (!value) {
    return ''
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date)
}

function factionTitle(faction: 'Alliance' | 'Horde') {
  return faction === 'Alliance' ? '🔵 Alliance' : '🔴 Horde'
}

function updatePrebuiltTitle() {
  const datePart = formatPrebuiltDate(form.date_to)
  const factionPart = factionTitle(sessionFaction.value)
  const instancePart = selectedInstances.value.map(instance => instance.name).join(' + ')
  const raidPart = [factionPart, instancePart].filter(Boolean).join(' ')

  form.title = datePart ? `${datePart} , ${raidPart}` : raidPart
}

function toggleInstance(id: number) {
  if (selectedInstanceIds.value.includes(id)) {
    selectedInstanceIds.value = selectedInstanceIds.value.filter(instanceID => instanceID !== id)
    return
  }
  selectedInstanceIds.value = [...selectedInstanceIds.value, id]
}

function isInstanceSelected(id: number) {
  return selectedInstanceIds.value.includes(id)
}

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
  await navigator.clipboard.writeText(url.toString())
}

async function submitCreate() {
  updatePrebuiltTitle()
  if (!form.title.trim()) {
    return
  }
  try {
    await sessionsStore.create({ ...form, instance_ids: selectedInstanceIds.value })
    showCreate.value = false
    form.title = ''
    form.date_to = defaultRaidDate()
    sessionFaction.value = 'Alliance'
    selectedInstanceIds.value = []
    updatePrebuiltTitle()
  } catch {
    // store exposes error
  }
}

async function endSession(id: string) {
  try {
    await sessionsStore.end(id)
  } catch {
    // store exposes error
  }
}
</script>

<template>
  <main class="public-shell">
    <AdminNav title="Sessions" />

    <UAlert
      v-if="error"
      color="error"
      variant="soft"
      icon="i-lucide-circle-alert"
      :title="error"
      class="mb-4"
    />

    <UCard
      v-if="showCreate"
      class="public-login-card mb-6"
    >
      <form
        class="login-form"
        @submit.prevent="submitCreate"
      >
        <UFormField
          label="Prebuilt title"
          required
        >
          <UInput
            v-model="form.title"
            readonly
            class="w-full"
            placeholder="Pick date, faction, and raid instances"
          />
        </UFormField>
        <UFormField label="Faction">
          <USelect
            v-model="sessionFaction"
            :items="factionOptions"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Raid instances">
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
        </UFormField>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Min bid">
            <UInput
              v-model.number="form.default_min_bid"
              type="number"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Increment">
            <UInput
              v-model.number="form.default_bid_increment"
              type="number"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Timer (seconds)">
            <UInput
              v-model.number="form.default_timer_seconds"
              type="number"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Currency">
            <USelect
              v-model="form.bid_currency"
              :items="['dollar', 'gold']"
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField label="Raid date">
          <UInput
            v-model="form.date_to"
            class="w-full"
            placeholder="2026-07-01"
          />
        </UFormField>
        <UButton
          type="submit"
          label="Create session"
          icon="i-lucide-check"
          block
          class="justify-center"
          :loading="saving"
        />
        <UButton
          color="neutral"
          variant="ghost"
          label="Back to session list"
          icon="i-lucide-list"
          block
          class="justify-center"
          @click="showCreate = false"
        />
      </form>
    </UCard>

    <template v-else>
      <div
        v-if="loading"
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
          @click="showCreate = true"
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
                @click="showCreate = true"
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
                  @click.stop="endSession(row.id)"
                />
              </UTooltip>
            </div>
          </template>
        </AdminDataTable>
      </div>
    </template>
  </main>
</template>
