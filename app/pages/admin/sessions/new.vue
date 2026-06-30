<script setup lang="ts">
import type { CreateSessionRequest } from '#shared/types/api'

definePageMeta({ middleware: 'admin' })

const sessionsStore = useSessionsStore()
const catalog = useCatalogStore()
const { saving, error } = storeToRefs(sessionsStore)
const { instances } = storeToRefs(catalog)

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
const sessionFaction = ref<'Alliance' | 'Horde'>('Alliance')
const factionOptions = ['Alliance', 'Horde']

const selectedInstances = computed(() => instances.value.filter(instance => selectedInstanceIds.value.includes(instance.id)))

onMounted(() => {
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
          to="/admin"
        />
      </form>
    </UCard>
  </main>
</template>
