<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()

const adminAuth = useAdminAuthStore()
const route = useRoute()

const navItems = [
  { label: 'Sessions', icon: 'i-lucide-layout-dashboard', to: '/admin' },
  { label: 'Players', icon: 'i-lucide-users', to: '/admin/players' },
  { label: 'Money', icon: 'i-lucide-wallet-cards', to: '/admin/money' }
]

function isActive(to: string) {
  return to === '/admin' ? route.path === '/admin' : route.path.startsWith(to)
}

async function logout() {
  await adminAuth.logout()
  await navigateTo('/admin/login')
}
</script>

<template>
  <header class="admin-navbar">
    <div class="admin-navbar-brand">
      <div class="admin-navbar-mark">
        🧀
      </div>
      <div class="admin-navbar-title">
        <span>Cheese GDKP</span>
        <h1>{{ title }}</h1>
      </div>
    </div>

    <nav
      class="admin-navbar-links"
      aria-label="Admin navigation"
    >
      <UButton
        v-for="item in navItems"
        :key="item.to"
        :icon="item.icon"
        :label="item.label"
        :to="item.to"
        size="sm"
        :color="isActive(item.to) ? 'primary' : 'neutral'"
        :variant="isActive(item.to) ? 'solid' : 'soft'"
        class="admin-navbar-link"
      />
    </nav>

    <div class="admin-navbar-actions">
      <slot name="actions" />
      <div class="admin-navbar-user">
        <UIcon
          name="i-lucide-shield-check"
          class="admin-navbar-user-icon"
        />
        <span>{{ subtitle ?? (adminAuth.profile?.username ? `${adminAuth.profile.username} · admin` : 'admin') }}</span>
      </div>
      <UButton
        color="neutral"
        variant="ghost"
        icon="i-lucide-log-out"
        aria-label="Logout"
        size="sm"
        @click="logout"
      />
    </div>
  </header>
</template>
