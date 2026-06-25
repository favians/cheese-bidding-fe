import type { ApiEnvelope } from '#shared/types/api'

// Admin login: forwards credentials to the Go backend internal login, then
// stores the returned admin JWT in a separate httpOnly cookie.
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody<{ username?: string, password?: string }>(event)
  const username = body?.username?.trim()
  if (!username || !body?.password) {
    throw createError({ statusCode: 400, statusMessage: 'username and password are required' })
  }

  let res: ApiEnvelope<{ token: string }>
  try {
    res = await $fetch<ApiEnvelope<{ token: string }>>(
      `${config.backendBaseUrl}/api/v1/internal/auth/login`,
      { method: 'POST', body: { username, password: body.password } }
    )
  } catch (e: unknown) {
    const err = e as { statusCode?: number, data?: ApiEnvelope<unknown> }
    throw createError({
      statusCode: err.statusCode ?? 401,
      statusMessage: err.data?.error?.msg ?? 'invalid credentials'
    })
  }

  const token = res?.data?.token
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'invalid credentials' })
  }

  setCookie(event, config.adminAuthCookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: !import.meta.dev,
    path: '/',
    maxAge: 60 * 60 * 24 * 10
  })

  return { data: { ok: true }, pagination: null, error: { status: false, msg: '', code: 0 } }
})
