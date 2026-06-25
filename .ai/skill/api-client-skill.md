# API Client Skill

Use this when calling the backend from the CheeseBid frontend.

All network access goes through one `fetch` wrapper plus per-domain endpoint modules. Views, components, and stores never call `fetch` directly. The wrapper owns the backend contract: base URL, auth header, envelope unwrap, and error mapping.

## Use When

- adding a call to a backend endpoint
- creating an endpoint module for a new domain
- handling API errors, auth headers, or pagination
- changing how requests are built or responses unwrapped

Do not use this for: state storage (store skill), token lifecycle/guards (auth skill), rendering (component skill).

## The Contract (from the backend)

Every response is an envelope:

```json
{ "data": <payload|[]|null>, "pagination": {...}|null, "error": { "status": false, "msg": "", "code": 0 } }
```

- success: HTTP 2xx, `error.status = false`, payload in `data`
- failure: real HTTP status (401/403/404/409/500, never blanket-400), `error.status = true`, message in `error.msg`
- list endpoints carry `pagination`
- auth: `Authorization: Bearer <token>`

## Layout

- `api/client.js` — the single `request()` wrapper
- `api/<domain>.js` — endpoint functions for one domain, calling `request()`

```
api/
  client.js      request(), get(), post(), put(), del()
  auth.js        login(), getCurrent(), logout()
  session.js     getSession(code), placeBid(code, body), ...
```

## The Wrapper

`api/client.js` is the only place that touches `fetch`, the base URL, the auth header, and the envelope.

```js
import { getToken } from '@/stores/auth' // or read from the auth store
import { API_BASE_URL } from '@/config/env'

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message)
    this.name = 'ApiError'
    this.status = status   // HTTP status
    this.code = code       // backend error.code
  }
}

export async function request(method, path, { body, params, auth = true } = {}) {
  const url = new URL(API_BASE_URL + path)
  if (params) Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
  })

  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  // 204 / empty body
  const text = await res.text()
  const envelope = text ? JSON.parse(text) : { data: null, error: {} }

  if (!res.ok || envelope.error?.status) {
    throw new ApiError(envelope.error?.msg || res.statusText, res.status, envelope.error?.code)
  }

  return { data: envelope.data, pagination: envelope.pagination ?? null }
}

export const get  = (path, opts) => request('GET', path, opts)
export const post = (path, body, opts) => request('POST', path, { ...opts, body })
export const put  = (path, body, opts) => request('PUT', path, { ...opts, body })
export const del  = (path, opts) => request('DELETE', path, opts)
```

## Endpoint Modules

One module per domain. Each function names the use case and returns the unwrapped `data` (and `pagination` for lists). No `fetch`, no envelope handling here.

```js
// api/auth.js
import { post, get } from './client'

export const login = (username, password) =>
  post('/api/v1/auth/login', { username, password }, { auth: false })

export const getCurrent = () => get('/api/v1/auth/current')

// api/session.js
import { get, post } from './client'

export const getSession = (code) => get(`/api/v1/client/sessions/${code}`)
export const listSessions = (params) => get('/api/v1/internal/sessions', { params }) // returns { data, pagination }
export const placeBid = (code, body) => post(`/api/v1/client/sessions/${code}/bids`, body)
```

## Rules

- the wrapper is the ONLY place that calls `fetch`, builds the base URL, sets the auth header, or reads `error`/`data`/`pagination`
- endpoint functions are named for the use case (`getSession`, `placeBid`, `listSessions`), domain-grouped
- success returns the unwrapped payload; lists return `{ data, pagination }`
- failure throws `ApiError(msg, status, code)` — callers (stores) catch it; never return a raw envelope to a view
- auth header is attached automatically when `auth !== false`; login/public calls pass `auth: false`
- query params go through the `params` option (the wrapper skips empty values); never hand-concatenate query strings
- base URL comes from `config/env` (`VITE_API_BASE_URL`); never hardcode hosts
- send/parse JSON; for file upload use `FormData` and let the browser set the content type (a dedicated wrapper path)

## Error Handling

- the wrapper throws `ApiError` with the real HTTP status, so callers can branch: 401 -> force re-login, 403 -> forbidden, 404 -> not found, 409 -> conflict, else generic
- 401 handling (token expired/invalid) belongs in the auth layer/interceptor, not scattered in views
- stores catch `ApiError` and translate it into state (error message, redirect); components show what the store exposes
- never swallow an error silently; surface a message or a state flag

## Anti-Patterns

- `fetch` or `axios` in a view, component, or store
- reading `response.data.data` in a view (the wrapper already unwrapped it)
- returning the raw envelope upward instead of throwing on error
- hardcoded base URLs or hand-built `?a=1&b=2` query strings
- blanket `try/catch` that hides the HTTP status (lose the ability to handle 401 vs 404)
- duplicating the auth-header logic per call

## Checklist

- call goes through an `api/<domain>.js` function, which uses the wrapper
- the wrapper is the only `fetch` site
- success path uses unwrapped `data` (+ `pagination` for lists)
- failure throws `ApiError`; the caller handles status codes meaningfully
- auth header automatic; public calls pass `auth: false`
- params via the `params` option; base URL from env
- no envelope/data-data leakage into views

If any item fails, the call is not ready.
