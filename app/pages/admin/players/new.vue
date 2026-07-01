<script setup lang="ts">
import type { AdminCreateClientRequest } from '#shared/types/api'

definePageMeta({ middleware: 'admin' })

const store = useAdminClientsStore()
const { saving, error } = storeToRefs(store)
const showPassword = ref(false)

const form = reactive<AdminCreateClientRequest>({
  username: '',
  password: '',
  discord_id: ''
})

async function submitCreate() {
  if (!form.username.trim() || !form.password.trim() || !form.discord_id.trim()) return
  try {
    await store.create({
      username: form.username.trim(),
      password: form.password.trim(),
      discord_id: form.discord_id.trim()
    })
    await navigateTo('/admin/players')
  } catch {
    // store exposes error
  }
}
</script>

<template>
  <main class="public-shell">
    <AdminNav
      title="New player"
      subtitle="Create a player account"
    >
      <template #actions>
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-arrow-left"
          label="Players"
          to="/admin/players"
        />
      </template>
    </AdminNav>

    <UCard class="public-login-card mb-6">
      <form
        class="login-form"
        @submit.prevent="submitCreate"
      >
        <div class="grid grid-cols-2 gap-3">
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
        <UFormField
          label="Password"
          required
        >
          <UInput
            v-model="form.password"
            :type="showPassword ? 'text' : 'password'"
            class="w-full"
            autocomplete="new-password"
          >
            <template #trailing>
              <UButton
                color="neutral"
                variant="ghost"
                size="xs"
                :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                :aria-label="showPassword ? 'Hide password' : 'Show password'"
                @click="showPassword = !showPassword"
              />
            </template>
          </UInput>
        </UFormField>
        <div class="session-create-actions">
          <UButton
            type="submit"
            label="Create player"
            icon="i-lucide-check"
            size="xl"
            :loading="saving"
          />
        </div>
      </form>
    </UCard>
  </main>
</template>
