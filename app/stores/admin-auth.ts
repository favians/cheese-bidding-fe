import type { AdminProfile } from '#shared/types/api'

export const useAdminAuthStore = defineStore('admin-auth', () => {
  const profile = ref<AdminProfile | null>(null)
  const loading = ref(false)
  const initialized = ref(false)
  const error = ref('')

  const isAuthenticated = computed(() => profile.value !== null)

  async function loadProfile() {
    const { request } = useApi()
    profile.value = await request<AdminProfile>('/api/v1/internal/auth/current')
    return profile.value
  }

  async function bootstrap() {
    if (initialized.value) {
      return
    }
    loading.value = true
    try {
      await loadProfile()
    } catch {
      profile.value = null
    } finally {
      initialized.value = true
      loading.value = false
    }
  }

  async function login(username: string, password: string) {
    const { request } = useApi()
    loading.value = true
    error.value = ''
    try {
      await request<{ ok: boolean }>('/api/auth/admin-login', {
        method: 'POST',
        body: { username, password }
      })
      await loadProfile()
      initialized.value = true
    } catch (cause) {
      profile.value = null
      error.value = cause instanceof Error ? cause.message : 'Login failed'
      throw cause
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    const { request } = useApi()
    try {
      await request<{ status: boolean }>('/api/auth/admin-logout', { method: 'POST' })
    } finally {
      clearSession()
    }
  }

  function clearSession() {
    profile.value = null
    initialized.value = true
  }

  return {
    profile,
    loading,
    initialized,
    error,
    isAuthenticated,
    bootstrap,
    login,
    logout,
    clearSession
  }
})
