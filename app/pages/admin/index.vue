<script setup lang="ts">
import type { CreateSessionRequest } from '#shared/types/api'

definePageMeta({ middleware: 'admin' })

const adminAuth = useAdminAuthStore()
const sessionsStore = useSessionsStore()
const { sessions, loading, saving, error } = storeToRefs(sessionsStore)

const showCreate = ref(false)
const form = reactive<CreateSessionRequest>({
  title: '',
  instance_slugs: '',
  bid_currency: 'dollar',
  default_min_bid: 100,
  default_bid_increment: 1,
  default_timer_seconds: 5400,
  date_to: ''
})

onMounted(() => {
  sessionsStore.load()
})

async function submitCreate() {
  if (!form.title.trim()) {
    return
  }
  try {
    await sessionsStore.create({ ...form })
    showCreate.value = false
    form.title = ''
    form.instance_slugs = ''
    form.date_to = ''
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

async function logout() {
  await adminAuth.logout()
  await navigateTo('/admin/login')
}
</script>

<template>
  <main class="public-shell">
    <header class="topbar">
      <div class="brand">
        <div class="brand-head">
          <span class="brand-logo">🧀 Cheese GDKP</span>
        </div>
        <h1>Sessions</h1>
        <p>{{ adminAuth.profile?.username }} · admin</p>
      </div>
      <div class="brand-head">
        <UButton
          color="primary"
          icon="i-lucide-plus"
          label="New session"
          @click="showCreate = !showCreate"
        />
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-log-out"
          label="Logout"
          @click="logout"
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

    <UCard
      v-if="showCreate"
      class="public-login-card mb-6"
    >
      <form
        class="login-form"
        @submit.prevent="submitCreate"
      >
        <UFormField
          label="Title"
          required
        >
          <UInput
            v-model="form.title"
            class="w-full"
            placeholder="e.g. Karazhan Friday"
          />
        </UFormField>
        <UFormField label="Instances (comma-separated slugs)">
          <UInput
            v-model="form.instance_slugs"
            class="w-full"
            placeholder="karazhan,gruul"
          />
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
      </form>
    </UCard>

    <div
      v-if="loading"
      class="py-10 text-center opacity-70"
    >
      Loading…
    </div>
    <div
      v-else-if="!sessions.length"
      class="py-10 text-center opacity-70"
    >
      No sessions yet.
    </div>
    <div
      v-else
      class="grid gap-3"
    >
      <UCard
        v-for="session in sessions"
        :key="session.id"
        class="profile-hero-card"
      >
        <div class="flex items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <strong class="text-lg">{{ session.title }}</strong>
              <UBadge
                :color="session.status === 'active' ? 'success' : 'neutral'"
                variant="soft"
              >
                {{ session.status }}
              </UBadge>
            </div>
            <div class="mt-1 text-sm opacity-70">
              Code <span class="font-mono">{{ session.code }}</span> · {{ session.bid_currency }} · min {{ session.default_min_bid }} · {{ session.instance_slugs || 'no instances' }}
            </div>
          </div>
          <div class="flex gap-2">
            <UButton
              color="primary"
              variant="soft"
              icon="i-lucide-settings"
              label="Manage"
              :to="`/admin/sessions/${session.id}`"
            />
            <UButton
              v-if="session.status === 'active'"
              color="error"
              variant="soft"
              icon="i-lucide-square"
              label="End"
              @click="endSession(session.id)"
            />
          </div>
        </div>
      </UCard>
    </div>
  </main>
</template>
