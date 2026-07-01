<script setup lang="ts">
import type { CreateSessionRequest } from '#shared/types/api'

definePageMeta({ middleware: 'admin' })

const sessionsStore = useSessionsStore()
const catalog = useCatalogStore()
const { saving, error } = storeToRefs(sessionsStore)
const { instances } = storeToRefs(catalog)

const STORAGE_KEY_FACTION = 'cheesebidding:new-session:faction'
const STORAGE_KEY_INSTANCE_IDS = 'cheesebidding:new-session:instance-ids'

type SessionFaction = 'Alliance' | 'Horde'

function defaultRaidDate() {
  const date = new Date()
  date.setDate(date.getDate() - 1)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const form = reactive<CreateSessionRequest>({
  title: '',
  bid_currency: 'dollar',
  default_min_bid: 100,
  default_bid_increment: 1,
  default_timer_seconds: 5400,
  date_to: defaultRaidDate()
})
const selectedInstanceIds = ref<number[]>([])
const sessionFaction = ref<SessionFaction>('Alliance')
const raidDateField = ref<HTMLElement | null>(null)
const factionOptions: Array<{ value: SessionFaction, label: string }> = [
  { value: 'Alliance', label: '🔵 Alliance' },
  { value: 'Horde', label: '🔴 Horde' }
]
const currencyOptions: Array<{ value: NonNullable<CreateSessionRequest['bid_currency']>, label: string }> = [
  { value: 'dollar', label: '💵 Dollar' },
  { value: 'gold', label: '🪙 Gold' }
]

const selectedInstances = computed(() => instances.value.filter(instance => selectedInstanceIds.value.includes(instance.id)))

onMounted(async () => {
  restoreSessionDraft()
  await catalog.loadInstances()
  pruneStoredInstanceIds()
  updatePrebuiltTitle()
})

watch([selectedInstanceIds, sessionFaction, () => form.date_to, instances], updatePrebuiltTitle)
watch(sessionFaction, persistFaction)
watch(selectedInstanceIds, persistInstanceIds, { deep: true })

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

function factionTitle(faction: SessionFaction) {
  return faction === 'Alliance' ? '🔵 Alliance' : '🔴 Horde'
}

function updatePrebuiltTitle() {
  const datePart = formatPrebuiltDate(form.date_to)
  const factionPart = factionTitle(sessionFaction.value)
  const instancePart = selectedInstances.value.map(instance => instance.name).join(' + ')
  const raidPart = [factionPart, instancePart].filter(Boolean).join(' ')
  form.title = datePart ? `${datePart} , ${raidPart}` : raidPart
}

function restoreSessionDraft() {
  if (!import.meta.client) return

  const storedFaction = window.localStorage.getItem(STORAGE_KEY_FACTION)
  if (storedFaction === 'Alliance' || storedFaction === 'Horde') {
    sessionFaction.value = storedFaction
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY_INSTANCE_IDS) || '[]')
    if (Array.isArray(parsed)) {
      selectedInstanceIds.value = parsed
        .map(value => Number(value))
        .filter(value => Number.isInteger(value) && value > 0)
    }
  } catch {
    selectedInstanceIds.value = []
  }
}

function persistFaction() {
  if (!import.meta.client) return
  window.localStorage.setItem(STORAGE_KEY_FACTION, sessionFaction.value)
}

function persistInstanceIds() {
  if (!import.meta.client) return
  window.localStorage.setItem(STORAGE_KEY_INSTANCE_IDS, JSON.stringify(selectedInstanceIds.value))
}

function pruneStoredInstanceIds() {
  if (!instances.value.length || !selectedInstanceIds.value.length) return
  const validIds = new Set(instances.value.map(instance => instance.id))
  selectedInstanceIds.value = selectedInstanceIds.value.filter(id => validIds.has(id))
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

function selectFaction(faction: SessionFaction) {
  sessionFaction.value = faction
}

function isFactionSelected(faction: SessionFaction) {
  return sessionFaction.value === faction
}

function openRaidDatePicker() {
  if (!import.meta.client) return
  const input = raidDateField.value?.querySelector('input[type="date"]') as (HTMLInputElement & { showPicker?: () => void }) | null
  if (!input) return
  input.focus()
  input.showPicker?.()
}

function selectCurrency(currency: NonNullable<CreateSessionRequest['bid_currency']>) {
  form.bid_currency = currency
}

function isCurrencySelected(currency: NonNullable<CreateSessionRequest['bid_currency']>) {
  return form.bid_currency === currency
}

async function submitCreate() {
  updatePrebuiltTitle()
  if (!form.title.trim()) {
    return
  }
  try {
    const session = await sessionsStore.create({ ...form, instance_ids: selectedInstanceIds.value })
    // jump straight into managing the freshly-created session
    await navigateTo(`/admin/sessions/${session.id}`)
  } catch {
    // store exposes error
  }
}
</script>

<template>
  <main class="public-shell">
    <AdminNav
      title="New session"
      subtitle="Create a raid bidding session"
    >
      <template #actions>
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-arrow-left"
          label="Session list"
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

    <UCard class="public-login-card mb-6">
      <form
        class="login-form"
        @submit.prevent="submitCreate"
      >
        <section class="session-prebuilt-title">
          <span>Title</span>
          <h3>{{ form.title || 'Pick date, faction, and raid instances' }}</h3>
        </section>
        <UFormField label="Faction">
          <div class="session-instance-picker session-faction-picker">
            <button
              v-for="faction in factionOptions"
              :key="faction.value"
              type="button"
              class="session-instance-choice"
              :class="{ 'is-selected': isFactionSelected(faction.value) }"
              @click="selectFaction(faction.value)"
            >
              <span>{{ faction.label }}</span>
            </button>
          </div>
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
              <small>{{ instance.expansion.toUpperCase() }}</small>
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
            <div class="session-instance-picker session-compact-picker">
              <button
                v-for="currency in currencyOptions"
                :key="currency.value"
                type="button"
                class="session-instance-choice"
                :class="{ 'is-selected': isCurrencySelected(currency.value) }"
                @click="selectCurrency(currency.value)"
              >
                <span>{{ currency.label }}</span>
              </button>
            </div>
          </UFormField>
          <UFormField
            label="Raid date"
            class="session-date-field"
          >
            <div
              ref="raidDateField"
              class="session-date-picker-trigger"
              @click="openRaidDatePicker"
            >
              <UInput
                v-model="form.date_to"
                type="date"
                class="w-full"
              />
            </div>
          </UFormField>
        </div>
        <div class="session-create-actions">
          <UButton
            type="submit"
            label="Create session"
            icon="i-lucide-check"
            size="xl"
            :loading="saving"
          />
        </div>
      </form>
    </UCard>
  </main>
</template>
