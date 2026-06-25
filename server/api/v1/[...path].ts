// BFF proxy: forwards /api/v1/** to the Go backend, attaching the player's
// JWT (read from the httpOnly cookie) as a Bearer header server-side.
// The browser never sees the token and never talks to the backend directly.
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const path = getRouterParam(event, 'path') ?? ''
  const token = getCookie(event, config.authCookieName)
  const search = getRequestURL(event).search
  const target = `${config.backendBaseUrl}/api/v1/${path}${search}`

  return proxyRequest(event, target, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  })
})
