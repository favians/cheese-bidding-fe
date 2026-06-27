<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const play = usePlayStore()
const code = ref('')

async function submit() {
  if (!code.value.trim()) {
    play.error = 'Enter a session code'
    return
  }
  try {
    const member = await play.joinByCode(code.value)
    await navigateTo(`/play/${member.session_id}`)
  } catch {
    // store exposes a safe error message
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
        <h1>Join Session</h1>
        <p>Enter the code your raid leader shared</p>
      </div>
      <UButton
        color="neutral"
        variant="ghost"
        icon="i-lucide-wallet"
        label="Wallet"
        to="/wallet"
      />
    </header>

    <section class="public-login-layout">
      <UCard class="public-login-card">
        <form
          class="login-form"
          @submit.prevent="submit"
        >
          <UFormField
            label="Session code"
            required
            size="xl"
          >
            <UInput
              v-model="code"
              class="w-full uppercase"
              size="xl"
              placeholder="e.g. 7F3A2C"
              icon="i-lucide-ticket"
              autocomplete="off"
            />
          </UFormField>

          <UAlert
            v-if="play.error"
            color="error"
            variant="soft"
            icon="i-lucide-circle-alert"
            :title="play.error"
          />

          <UButton
            type="submit"
            label="Join"
            icon="i-lucide-log-in"
            size="xl"
            block
            class="justify-center"
            :loading="play.joining"
          />
        </form>
      </UCard>
    </section>
  </main>
</template>
