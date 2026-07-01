<script setup lang="ts">
const adminAuth = useAdminAuthStore()
const username = ref('')
const password = ref('')

await adminAuth.bootstrap()
if (adminAuth.isAuthenticated) {
  await navigateTo('/admin')
}

async function submitLogin() {
  if (!username.value.trim() || !password.value) {
    adminAuth.error = 'Username and password are required'
    return
  }
  try {
    await adminAuth.login(username.value, password.value)
    await navigateTo('/admin')
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
        <h1>Admin</h1>
        <p>Raid session management</p>
      </div>
    </header>

    <section class="public-login-layout">
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
              placeholder="Admin username"
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
              placeholder="Password"
              icon="i-lucide-lock-keyhole"
              size="xl"
            />
          </UFormField>

          <UButton
            type="submit"
            label="Login"
            icon="i-lucide-log-in"
            size="xl"
            block
            class="login-submit justify-center"
            :loading="adminAuth.loading"
          />
        </form>
      </UCard>
    </section>
  </main>
</template>
