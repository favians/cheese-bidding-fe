# Auth Skill (Frontend)

Use this when handling login, tokens, identity, or route protection in the CheeseBid frontend.

The backend issues JWT bearer tokens (two contexts: client/player and internal/admin). The frontend stores a token, attaches it to requests, loads the current identity, guards routes, and handles expiry. This skill owns that lifecycle; the api-client skill owns the transport and the store skill owns the state container.

## Use When

- implementing login / logout / refresh
- storing or reading the auth token
- protecting routes by auth tier
- handling 401 (expired/invalid token)
- loading the current user on app boot

Do not use this for: the fetch wrapper (api-client skill), generic store rules (store skill), backend token internals (that is the backend auth skill).

## Token Model

- the backend returns `{ token }` from login; it is a JWT bearer
- two contexts: a player token (client routes) and an admin token (internal routes), obtained from separate logins and signed with separate secrets server-side
- the frontend treats a token as opaque: store it, send it, drop it on logout/401. Do not decode it for trust decisions
- the api client attaches `Authorization: Bearer <token>` automatically (api-client skill)

## Token Storage

- store the token in the auth store, persisted to `localStorage` under a namespaced key (`cb_token`, and `cb_admin_token` if an admin session is separate)
- read it back on store init so a reload keeps the session
- the api client reads the token via the auth store / a `getToken()` accessor
- clear the key on logout and on a 401
- never store passwords; never put the token in a cookie unless the backend switches to cookie auth

## Login / Logout Flow

- login: call the auth api (`auth: false`), save the token, then `loadCurrent()` to populate the user, then redirect to the intended route
- logout: clear token + user + persisted keys, redirect to the login route
- on app boot: if a token exists, call `loadCurrent()`; if it 401s, treat as logged out
- keep this flow in the auth store (store skill); views call store actions

## Route Guards

- the router enforces auth tiers with a global `beforeEach` guard (routing skill)
- mark routes with `meta` (`requiresAuth`, `requiresAdmin`); the guard reads the auth store
- unauthenticated access to a protected route -> redirect to login, remembering the target
- a player token must not satisfy an admin route, and vice versa

```js
// router/guards.js
import { useAuthStore } from '@/stores/auth'

export function authGuard(to) {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.meta.requiresAdmin && !auth.isAdmin) {
    return { name: 'login' }
  }
}
```

## Expiry / 401 Handling

- a 401 from any call means the token is invalid or expired
- handle it in ONE place (an api-client response check or a small interceptor), not per view: clear auth state and redirect to login
- there is no silent refresh today (backend is stateless JWT with `expiredHour`); on 401 the user re-logs in
- if a refresh endpoint is wired later, attempt one refresh on 401 before forcing re-login

## Security Rules

- the JWT lives only in the browser after login; it is never baked into the build
- do not log the token or put it in URLs
- treat `loadCurrent()` (`/auth/current`) as the source of identity, not decoded claims
- gate UI on the loaded user/role, but never rely on the frontend for real authorization — the backend enforces it

## Anti-Patterns

- decoding the JWT to decide what the user may do
- scattering 401 handling across views
- storing the token in a plain global variable that does not survive reload, or in a non-namespaced key
- a player token reused on admin routes
- showing protected UI before the current-user check resolves (flash of logged-in state)

## Checklist

- token stored in the auth store + namespaced `localStorage`, read on init, cleared on logout/401
- login saves token then loads current user then redirects
- app boot loads current user when a token exists
- routes carry `requiresAuth`/`requiresAdmin` meta; a global guard enforces them
- 401 handled in one place -> clear + redirect to login
- player vs admin tokens kept distinct
- no JWT decoding for trust; UI gates on loaded identity only

If any item fails, the auth flow is not ready.

## Two auth contexts (player + admin) — as built

Two independent httpOnly cookies, never mixed:
- player: `cb_token`, set by `server/api/auth/login.post.ts` (→ Go `/api/v1/auth/login`). Store `useAuthStore`, guard `middleware/auth.ts` → `/`.
- admin: `cb_admin_token`, set by `server/api/auth/admin-login.post.ts` (→ Go `/api/v1/internal/auth/login`). Store `useAdminAuthStore`, guard `middleware/admin.ts` → `/admin/login`. Logout `admin-logout.post.ts`.

The **Nitro proxy picks the token by path**: `server/api/v1/[...path].ts` attaches `cb_admin_token` for `/api/v1/internal/*`, `cb_token` otherwise. A page just calls `useApi().request('/api/v1/internal/...')` or `'/api/v1/client/...'`; the right token is attached server-side. Cookie names in `runtimeConfig` (`authCookieName`, `adminAuthCookieName`).

Rules:
- a Nitro login route forwards creds to Go, reads `data.token`, sets the cookie httpOnly+sameSite+secure, returns `{ ok: true }` — never the token.
- the browser never holds either token. SSE/EventSource works because it's same-origin to Nitro (cookie sent) and Nitro attaches the bearer.
- admin is NOT a session member → admin screens cannot use the client SSE stream; they poll.
