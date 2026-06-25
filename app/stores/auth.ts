import type { ClientProfile } from '#shared/types/api'

export const useAuthStore = defineStore('auth', () => {
  const profile = ref<ClientProfile | null>(null)
  const loading = ref(false)
  const initialized = ref(false)
  const error = ref('')

  const isAuthenticated = computed(() => profile.value !== null)

  async function loadProfile() {
    const { request } = useApi()
    profile.value = await request<ClientProfile>('/api/v1/client/profile')
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
      await request<{ ok: boolean }>('/api/auth/login', {
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
      await request<{ status: boolean }>('/api/auth/logout', { method: 'POST' })
    } finally {
      profile.value = null
      initialized.value = true
    }
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    const { request } = useApi()
    loading.value = true
    error.value = ''
    try {
      await request<{ status: boolean }>('/api/v1/client/password', {
        method: 'PUT',
        body: {
          current_password: currentPassword,
          new_password: newPassword
        }
      })
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Password update failed'
      throw cause
    } finally {
      loading.value = false
    }
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
    changePassword
  }
})
