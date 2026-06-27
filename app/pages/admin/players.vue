<script setup lang="ts">
import type { AdminCreateClientRequest } from '#shared/types/api'

definePageMeta({ middleware: 'admin' })

const store = useAdminClientsStore()
const { clients, loading, saving, error, lastPassword } = storeToRefs(store)

const search = ref('')
const showCreate = ref(false)
const form = reactive<AdminCreateClientRequest>({ username: '', password: '', discord_id: '' })
let timer: ReturnType<typeof setTimeout> | undefined

onMounted(() => store.load())

watch(search, () => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => store.load(search.value), 250)
})

async function submitCreate() {
  if (!form.username.trim() || !form.password.trim() || !form.discord_id.trim()) return
  try {
    await store.create({ ...form })
    form.username = ''
    form.password = ''
    form.discord_id = ''
    showCreate.value = false
  } catch {
    // store exposes error
  }
}

async function editDiscord(id: number, current: string) {
  const next = window.prompt('Discord ID', current)
  if (next && next.trim() && next.trim() !== current) {
    await store.updateDiscord(id, next.trim())
  }
}

async function copyPassword() {
  if (lastPassword.value) {
    await navigator.clipboard.writeText(`${lastPassword.value.username} / ${lastPassword.value.password}`)
  }
}

function dismissPassword() {
  lastPassword.value = null
}
</script>

<template>
  <main class="public-shell">
    <header class="topbar">
      <div class="brand">
        <div class="brand-head">
          <span class="brand-logo">🧀 Cheese GDKP</span>
        </div>
        <h1>Players</h1>
        <p>Onboard & manage player accounts</p>
      </div>
      <div class="brand-head">
        <UButton
          color="primary"
          icon="i-lucide-user-plus"
          label="New player"
          @click="showCreate = !showCreate"
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

    <!-- one-time password reveal -->
    <UAlert
      v-if="lastPassword"
      color="success"
      variant="soft"
      icon="i-lucide-key-round"
      class="mb-4"
      :title="`Password for ${lastPassword.username}`"
      :description="`${lastPassword.password} — copy and share it now; it won't be shown again.`"
      :actions="[
        { label: 'Copy', color: 'success', variant: 'soft', onClick: copyPassword },
        { label: 'Dismiss', color: 'neutral', variant: 'ghost', onClick: dismissPassword }
      ]"
    />

    <UCard
      v-if="showCreate"
      class="public-login-card mb-6"
    >
      <form
        class="login-form"
        @submit.prevent="submitCreate"
      >
        <div class="grid grid-cols-3 gap-3">
          <UFormField
            label="Username"
            required
          >
            <UInput
              v-model="form.username"
              class="w-full"
              autocomplete="off"
            />
          </UFormField>
          <UFormField
            label="Password"
            required
          >
            <UInput
              v-model="form.password"
              class="w-full"
              autocomplete="off"
            />
          </UFormField>
          <UFormField
            label="Discord ID"
            required
          >
            <UInput
              v-model="form.discord_id"
              class="w-full"
              placeholder="name#1234"
            />
          </UFormField>
        </div>
        <UButton
          type="submit"
          label="Create player"
          icon="i-lucide-check"
          block
          class="justify-center"
          :loading="saving"
        />
      </form>
    </UCard>

    <UInput
      v-model="search"
      class="mb-4 w-full"
      icon="i-lucide-search"
      placeholder="Search by username or discord…"
    />

    <div
      v-if="loading && !clients.length"
      class="py-8 text-center opacity-70"
    >
      Loading…
    </div>
    <div
      v-else-if="!clients.length"
      class="py-8 text-center opacity-70"
    >
      No players.
    </div>
    <div
      v-else
      class="grid gap-2"
    >
      <div
        v-for="c in clients"
        :key="c.id"
        class="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2"
      >
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <strong>{{ c.username }}</strong>
            <span class="text-xs opacity-50">#{{ c.id }}</span>
            <UIcon
              v-if="c.is_favorite"
              name="i-lucide-star"
              class="h-4 w-4 text-(--color-cheese-400)"
            />
            <UBadge
              v-if="!c.is_active"
              color="neutral"
              variant="soft"
            >
              inactive
            </UBadge>
          </div>
          <div class="truncate text-xs opacity-60">
            {{ c.discord_id }}
          </div>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <UButton
            size="xs"
            color="neutral"
            variant="soft"
            icon="i-lucide-pencil"
            label="Discord"
            @click="editDiscord(c.id, c.discord_id)"
          />
          <UButton
            size="xs"
            :color="c.is_favorite ? 'warning' : 'neutral'"
            variant="soft"
            :icon="c.is_favorite ? 'i-lucide-star-off' : 'i-lucide-star'"
            :label="c.is_favorite ? 'Unfav' : 'Fav'"
            @click="store.setFavorite(c.id, !c.is_favorite)"
          />
          <UButton
            size="xs"
            :color="c.is_active ? 'error' : 'success'"
            variant="soft"
            :label="c.is_active ? 'Deactivate' : 'Activate'"
            @click="store.setActive(c.id, !c.is_active)"
          />
          <UButton
            size="xs"
            color="primary"
            variant="soft"
            icon="i-lucide-key-round"
            label="Reset pw"
            @click="store.resetPassword(c.id)"
          />
        </div>
      </div>
    </div>
  </main>
</template>
