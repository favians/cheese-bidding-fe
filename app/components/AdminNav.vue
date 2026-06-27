<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()

const adminAuth = useAdminAuthStore()
const route = useRoute()

const navItems = [
  { label: 'Sessions', icon: 'i-lucide-gavel', to: '/admin' },
  { label: 'Players', icon: 'i-lucide-users', to: '/admin/players' },
  { label: 'Money', icon: 'i-lucide-banknote', to: '/admin/money' }
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
  <header class="topbar admin-nav">
    <div class="brand">
      <div class="brand-head">
        <span class="brand-logo">🧀 Cheese GDKP</span>
      </div>
      <h1>{{ title }}</h1>
      <p>{{ subtitle ?? (adminAuth.profile?.username ? `${adminAuth.profile.username} · admin` : 'admin') }}</p>
    </div>
    <nav class="nav-actions">
      <slot name="actions" />
      <UButton
        v-for="item in navItems"
        :key="item.to"
        :icon="item.icon"
        :label="item.label"
        :to="item.to"
        size="sm"
        :color="isActive(item.to) ? 'primary' : 'neutral'"
        :variant="isActive(item.to) ? 'solid' : 'soft'"
      />
      <UButton
        color="neutral"
        variant="ghost"
        icon="i-lucide-log-out"
        label="Logout"
        size="sm"
        @click="logout"
      />
    </nav>
  </header>
</template>
