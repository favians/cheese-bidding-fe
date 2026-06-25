import type { ApiEnvelope } from '#shared/types/api'

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

export function useApi() {
  async function request<T>(path: string, options: Parameters<typeof $fetch>[1] = {}): Promise<T> {
    try {
      const envelope = await $fetch<ApiEnvelope<T>>(path, options)
      if (envelope.error?.status) {
        throw new ApiClientError(envelope.error.msg, 500, envelope.error.code)
      }
      return envelope.data
    } catch (error: unknown) {
      if (error instanceof ApiClientError) {
        throw error
      }
      const fetchError = error as {
        statusCode?: number
        status?: number
        statusMessage?: string
        data?: { error?: { msg?: string }, message?: string }
      }
      throw new ApiClientError(
        fetchError.data?.error?.msg
        ?? fetchError.data?.message
        ?? fetchError.statusMessage
        ?? 'Request failed',
        fetchError.statusCode ?? fetchError.status ?? 500
      )
    }
  }

  return { request }
}
