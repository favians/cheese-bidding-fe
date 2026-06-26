import type { SessionMember } from '#shared/types/api'

export const usePlayStore = defineStore('play', () => {
  const member = ref<SessionMember | null>(null)
  const joining = ref(false)
  const error = ref('')

  // joinByCode joins (or re-enters) the session identified by the code and
  // returns the member row, whose session_id drives the bidding view route.
  async function joinByCode(code: string) {
    const { request } = useApi()
    joining.value = true
    error.value = ''
    try {
      const result = await request<SessionMember>(
        `/api/v1/client/sessions/${encodeURIComponent(code.trim())}/member`,
        { method: 'POST' }
      )
      member.value = result
      return result
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Could not join session'
      throw cause
    } finally {
      joining.value = false
    }
  }

  return { member, joining, error, joinByCode }
})
