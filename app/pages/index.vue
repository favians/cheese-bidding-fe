<script setup lang="ts">
const auth = useAuthStore()
const username = ref('')
const password = ref('')

await auth.bootstrap()
if (auth.isAuthenticated) {
  await navigateTo('/profile')
}

async function submitLogin() {
  if (!username.value.trim() || !password.value) {
    auth.error = 'Username and password are required'
    return
  }
  try {
    await auth.login(username.value, password.value)
    await navigateTo('/profile')
  } catch {
    // Store exposes safe error message.
  }
}
</script>

<template>
  <main class="public-shell login-shell">
    <header class="topbar">
      <div class="brand">
        <div class="brand-head">
          <span class="brand-logo">🧀 Cheese GDKP</span>
        </div>
        <h1>Client Login</h1>
        <p>Real-time raid loot bidding</p>
      </div>
    </header>

    <section class="public-login-layout">
      <article class="login-intro">
        <span class="login-kicker">Real-time raid loot bidding</span>
        <h2>Cheese GDKP</h2>
        <p>Login with credentials from admin.</p>
      </article>

      <UCard class="public-login-card">
        <form
          class="login-form"
          @submit.prevent="submitLogin"
        >
          <UFormField
            label="Username"
            required
            size="xl"
          >
            <UInput
              v-model="username"
              class="w-full"
              name="username"
              autocomplete="username"
              placeholder="Enter your username"
              icon="i-lucide-user"
              size="xl"
            />
          </UFormField>

          <UFormField
            label="Password"
            required
            size="xl"
          >
            <UInput
              v-model="password"
              class="w-full"
              name="password"
              type="password"
              autocomplete="current-password"
              placeholder="Enter your password"
              icon="i-lucide-lock-keyhole"
              size="xl"
            />
          </UFormField>

          <UAlert
            v-if="auth.error"
            color="error"
            variant="soft"
            icon="i-lucide-circle-alert"
            :title="auth.error"
          />

          <UButton
            type="submit"
            label="Login"
            icon="i-lucide-log-in"
            size="xl"
            block
            class="login-submit justify-center"
            :loading="auth.loading"
          />
        </form>
      </UCard>
    </section>
  </main>
</template>
