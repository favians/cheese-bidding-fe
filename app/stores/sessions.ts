import type { Session, CreateSessionRequest, Pagination, SessionInstance } from '#shared/types/api'

export const useSessionsStore = defineStore('sessions', () => {
  const sessions = ref<Session[]>([])
  const pagination = ref<Pagination | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref('')

  async function load(params: { page?: number, status?: string, search?: string } = {}) {
    const { requestPaged } = useApi()
    loading.value = true
    error.value = ''
    try {
      const query: Record<string, string> = {}
      if (params.page) query.page = String(params.page)
      if (params.status) query.status = params.status
      if (params.search) query.search = params.search
      const { data, pagination: meta } = await requestPaged<Session[]>('/api/v1/internal/sessions', { query })
      sessions.value = data ?? []
      pagination.value = meta
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Sessions failed to load'
      throw cause
    } finally {
      loading.value = false
    }
  }

  async function create(payload: CreateSessionRequest) {
    const { request } = useApi()
    saving.value = true
    error.value = ''
    try {
      const session = await request<Session>('/api/v1/internal/sessions', {
        method: 'POST',
        body: payload
      })
      sessions.value = [session, ...sessions.value]
      return session
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Session could not be created'
      throw cause
    } finally {
      saving.value = false
    }
  }

  async function end(id: string) {
    const { request } = useApi()
    error.value = ''
    await request<{ status: boolean }>(`/api/v1/internal/sessions/${id}/end`, { method: 'POST' })
    const target = sessions.value.find(session => session.id === id)
    if (target) {
      target.status = 'ended'
    }
  }

  async function getInstances(id: string) {
    const { request } = useApi()
    return await request<SessionInstance[]>(`/api/v1/internal/sessions/${id}/instances`)
  }

  async function setInstances(id: string, instanceIds: number[]) {
    const { request } = useApi()
    saving.value = true
    error.value = ''
    try {
      return await request<SessionInstance[]>(`/api/v1/internal/sessions/${id}/instances`, {
        method: 'PUT',
        body: { instance_ids: instanceIds }
      })
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Session instances could not be saved'
      throw cause
    } finally {
      saving.value = false
    }
  }

  return { sessions, pagination, loading, saving, error, load, create, end, getInstances, setInstances }
})
