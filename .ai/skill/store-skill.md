# Store Skill

Use this when managing shared state in the CheeseBid frontend.

State that crosses views or outlives a single component lives in a Pinia store. A store holds state, exposes it, and calls the api client. It never touches the DOM or renders.

## Use When

- adding cross-view or persistent state (auth, current session, ...)
- wiring an action that calls the backend and stores the result
- exposing derived state to views

Do not use this for: local one-view state (keep it in the component), network shape (api-client skill), routing (routing skill).

## Identity

- one store per domain, in `stores/<domain>.js`
- use the setup (composition) store style to match `<script setup>`
- export `useXStore` (`stores/auth.js` -> `useAuthStore`)

```js
// stores/auth.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as authApi from '@/api/auth'
import { ApiError } from '@/api/client'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('cb_token') || '')
  const user = ref(null)
  const loading = ref(false)
  const error = ref('')

  const isLoggedIn = computed(() => !!token.value)

  async function login(username, password) {
    loading.value = true
    error.value = ''
    try {
      const { data } = await authApi.login(username, password)
      token.value = data.token
      localStorage.setItem('cb_token', data.token)
      await loadCurrent()
    } catch (e) {
      error.value = e instanceof ApiError ? e.message : 'Login failed'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function loadCurrent() {
    const { data } = await authApi.getCurrent()
    user.value = data
  }

  function logout() {
    token.value = ''
    user.value = null
    localStorage.removeItem('cb_token')
  }

  return { token, user, loading, error, isLoggedIn, login, loadCurrent, logout }
})
```

## Rules

- state is `ref`/`reactive`; derived values are `computed`; mutations happen in actions
- actions call the api client (`api/<domain>.js`), never `fetch` directly
- actions catch `ApiError` and translate it into store state (`error`, redirects), then optionally rethrow so the caller can react
- a store owns one domain; do not pile unrelated domains into one store
- stores do not import components, the router instance, or the DOM
- keep an `error` and `loading` convention so views render consistent states
- expose a flat return object (state + getters + actions); do not leak internal helpers

## State Placement

- shared across views or persisted -> store
- used by one view only and dies with it -> local component state (`ref` in the view)
- pure derivation with no state -> a `lib/` helper or `computed`, not a store

## Persistence

- only persist what must survive reload (the auth token); read it on store init
- do not mirror the entire server state into `localStorage`; refetch from the api on load
- clear persisted keys on logout

## Cross-Store Use

- a store may call another store via its `useXStore()` inside an action when needed
- avoid circular store dependencies; if two stores need each other, the boundary is wrong

## Anti-Patterns

- `fetch`/`axios` inside a store (go through `api/`)
- storing transient one-view UI state globally
- a god store holding many domains
- mutating state outside actions
- swallowing `ApiError` so the view cannot show a message
- persisting server lists to `localStorage` instead of refetching

## Checklist

- store is `stores/<domain>.js`, setup style, `useXStore` export
- one domain per store
- actions call the api client, catch `ApiError`, set `error`/`loading`
- only essential state persisted; cleared on logout
- no DOM, no component imports, no direct `fetch`
- views read state/getters and call actions; no business logic leaks into the view

If any item fails, the store is not ready.

## Realtime (SSE) in a store — as built (`stores/bidding.ts`)

Live updates arrive over SSE and **patch state in place** — never refetch the list on every event (that was V1's "omega slow" bug).

- `connect(sessionId)`: open `new EventSource('/api/v1/client/events?session_id=' + id)` (same-origin → Nitro attaches the player token). `addEventListener('auction.updated' | 'auction.created' | 'prebid.*', e => patch(JSON.parse(e.data)))`.
- `disconnect()`: `source?.close()`; call it in the page's `onBeforeUnmount`.
- patch helpers replace the matching item by id in the ref array (`findIndex` → assign), or unshift if new. A locally-placed bid uses the **same** patch path (the POST returns the updated entity), so the bidder's own action and others' SSE updates converge with no flicker.
- the page connects on mount and drops polling/timer refetch. Backend scheduler bulk close emits `auction.updated`, so timer closes arrive through the same patch path.
- derive transitions in the patch (e.g. "I held the top bid and an update took it" → set an `outbid` ref the page watches for a toast).

Rules:
- patch in place; do not reload the whole list on an event.
- `EventSource` only runs client-side — fine here (app is `ssr: false`).
- always `disconnect()` on unmount; a leaked EventSource reconnects forever.
- event names must match the BE publisher (`<entity>.<verb>`); see the backend realtime skill.

## List pagination — `requestPaged`

`useApi().request<T>` returns only `envelope.data`. For list endpoints that need the meta, use `requestPaged<T>` → `{ data, pagination }`. Item icons render from `/icons/<wow_item_id>.jpg` (static `public/icons`).
