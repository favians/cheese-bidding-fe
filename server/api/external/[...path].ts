// External API proxy: exposes V1-compatible CheesePayout endpoints through the
// same public FE origin when production traffic lands on Nuxt first.
// Auth stays payload-signature based on the Go backend; no browser cookie is
// attached here.
const allowedExternalPaths = new Set(['incoming-balances', 'item-debits'])

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const path = getRouterParam(event, 'path') ?? ''

  if (!allowedExternalPaths.has(path)) {
    throw createError({ statusCode: 404, statusMessage: 'external endpoint not found' })
  }

  const search = getRequestURL(event).search
  const target = `${config.backendBaseUrl}/api/external/${path}${search}`

  return proxyRequest(event, target)
})
