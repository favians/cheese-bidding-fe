// Dedicated SSE proxy for the realtime bidding stream.
// The generic catch-all (../[...path].ts) uses proxyRequest, which buffers the
// response body — fatal for Server-Sent Events (updates arrive in a delayed
// clump instead of live). This handler pipes the upstream stream chunk-by-chunk
// so events reach the browser the instant the backend flushes them.
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const token = getCookie(event, config.authCookieName)
  const search = getRequestURL(event).search
  const target = `${config.backendBaseUrl}/api/v1/client/events${search}`

  // abort the upstream request when the browser closes the EventSource
  const controller = new AbortController()
  event.node.req.on('close', () => controller.abort())

  const upstream = await fetch(target, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: controller.signal
  })

  if (!upstream.ok || !upstream.body) {
    setResponseStatus(event, upstream.status || 502)
    return upstream.statusText || 'sse upstream error'
  }

  setResponseHeaders(event, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    'connection': 'keep-alive',
    // stop any downstream proxy (nginx) from buffering the stream
    'x-accel-buffering': 'no'
  })

  // returning a ReadableStream tells h3 to stream it out without buffering
  return upstream.body
})
