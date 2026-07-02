import type { ApiEnvelope, Pagination } from '#shared/types/api'

function toApiError(error: unknown): ApiClientError {
  if (error instanceof ApiClientError) {
    return error
  }
  const fetchError = error as {
    statusCode?: number
    status?: number
    statusMessage?: string
    data?: { error?: { msg?: string }, message?: string }
  }
  return new ApiClientError(
    fetchError.data?.error?.msg
    ?? fetchError.data?.message
    ?? fetchError.statusMessage
    ?? 'Request failed',
    fetchError.statusCode ?? fetchError.status ?? 500
  )
}

export class ApiClientError extends Error {
  status: number
  code: number

  constructor(message: string, status = 500, code = 0) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.code = code
  }
}

const apiErrorToastCooldownMs = 1500
const recentApiErrorToasts = new Map<string, number>()

function isInternalApiPath(path: string) {
  return path === '/api/v1/internal' || path.startsWith('/api/v1/internal/')
}

function isClientApiPath(path: string) {
  return path === '/api/v1/client' || path.startsWith('/api/v1/client/')
}

async function handleAuthFailure(path: string, error: ApiClientError) {
  if (error.status !== 401) return

  if (isInternalApiPath(path)) {
    const adminAuth = useAdminAuthStore()
    adminAuth.clearSession()
    await navigateTo('/admin/login')
    return
  }

  if (isClientApiPath(path)) {
    const auth = useAuthStore()
    const route = useRoute()
    auth.clearSession()
    await navigateTo({ path: '/', query: { redirect: route.fullPath } })
  }
}

function notifyApiError(error: ApiClientError) {
  if (!import.meta.client) return

  const now = Date.now()
  const key = `${error.status}:${error.message}`
  const lastShownAt = recentApiErrorToasts.get(key) ?? 0
  if (now - lastShownAt < apiErrorToastCooldownMs) return
  recentApiErrorToasts.set(key, now)

  const toast = useToast()
  const isDuplicate = error.status === 409 || /duplicate/i.test(error.message)
  toast.add({
    title: isDuplicate ? 'Duplicate data' : 'Request failed',
    description: error.message,
    color: 'error',
    icon: isDuplicate ? 'i-lucide-copy-x' : 'i-lucide-circle-alert'
  })
}

export function useApi() {
  async function request<T>(path: string, options: Parameters<typeof $fetch>[1] = {}, silent = false): Promise<T> {
    try {
      const envelope = await $fetch<ApiEnvelope<T>>(path, options)
      if (envelope.error?.status) {
        throw new ApiClientError(envelope.error.msg, 500, envelope.error.code)
      }
      return envelope.data
    } catch (error: unknown) {
      const apiError = toApiError(error)
      // silent: caller handles it (e.g. membership probes that 403/404 by design)
      if (!silent) notifyApiError(apiError)
      await handleAuthFailure(path, apiError)
      throw apiError
    }
  }

  // requestPaged returns the unwrapped data plus the pagination meta (list endpoints).
  async function requestPaged<T>(path: string, options: Parameters<typeof $fetch>[1] = {}): Promise<{ data: T, pagination: Pagination | null }> {
    try {
      const envelope = await $fetch<ApiEnvelope<T>>(path, options)
      if (envelope.error?.status) {
        throw new ApiClientError(envelope.error.msg, 500, envelope.error.code)
      }
      return { data: envelope.data, pagination: envelope.pagination ?? null }
    } catch (error: unknown) {
      const apiError = toApiError(error)
      notifyApiError(apiError)
      await handleAuthFailure(path, apiError)
      throw apiError
    }
  }

  return { request, requestPaged }
}
