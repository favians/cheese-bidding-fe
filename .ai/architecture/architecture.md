# CheeseBid Frontend Architecture

## Status

Greenfield **Nuxt 3 + TypeScript** frontend for CheeseBid, replacing the old vanilla-JS SPA. Separate repo from the Go backend (`cheesebidding`). Migrated per module alongside each backend domain slice.

### Built so far
- **Auth**: player login (`/`) + admin login (`/admin/login`), two httpOnly-cookie contexts; the Nitro proxy attaches the admin token for `/api/v1/internal/*`, the player token otherwise.
- **Player bidding flow** (the core): `/play` join-by-code or `/play?code=<SESSION_CODE>` share link → `/play/[id]` live view. The live board has V1-style tabs: `Bid` for active auctions and `Prebid` for open prebids. One-tap quick-bid + custom amount, "Winning" crown when you lead, self-overbid confirm, mm:ss countdown (red+pulse <10s), outbid toast, Results section. Item icons from `/icons/<item_id>.jpg`.
- **Realtime (SSE)**: `bidding` store opens an `EventSource` to `/api/v1/client/events?session_id=` and patches auctions/prebids in place on `auction.*`/`prebid.*` events — no polling, no timer refetch. Backend scheduler auto-close emits `auction.updated`.
- **Session end compatibility**: FE listens to both V2 `session.updated` and V1-compatible `session.ended`; both trigger one bidding-state refetch.
- **Session ended UX**: `session.ended` keeps the final state visible and shows a clear "Session ended" banner above results.
- **Session deletion UX**: `session.deleted` closes SSE, clears live rows, and shows a "Session unavailable" state with a back-to-join action.
- **Live bidding V1 UI parity**: `/play/[id]` uses V1-like auction/prebid rows (`auction-card`, `loot-cell`, `item-icon`, `bid-state`, `timer-cell`, `bid-controls`) and the global cheese watermark is scoped to login/join pages only, so live/session pages keep the darker raid-board look.
- **Admin**: modern shared admin navbar (`AdminNav`) across sessions, players, money, and session detail; session list/create (`/admin`) with instance picker; session control panel (`/admin/sessions/[id]`) with session-instance assignment and copy-join as a single pasteable `/play?code=<SESSION_CODE>` URL — open auctions/prebids via the catalog **ItemPicker**, close/reset/cancel, resolve/cancel prebids, 2s refresh (admin isn't a session member so can't use the client SSE). Admin players (`/admin/players`) has search, active/inactive filter, pagination, favorite/active toggles, Discord edit, password reset reveal, expandable character management, and balance detail drilldown. Admin money (`/admin/money`) exists.
- **Catalog is id-based, no slug**: `Instance` has `id`; `Item` has `id` + `wow_item_id` + `instance_id`; the picker filters by `instance_id`. Icons keyed by `wow_item_id`.

### Remaining
- admin players V1 parity polish: deeper V1-like styling. Status filter, pagination, password reset flow, character management, and balance detail drilldown are in place.
- session/bidding hardening: broader edge-case tests for ended/deleted/session lifecycle flows.
- profile/character polish and V1 SQLite → Postgres migration support.

## Stack (locked)

- framework: **Nuxt 3** (Vue 3, Composition API, `<script setup>`)
- language: **TypeScript**
- UI: **Nuxt UI v4** (component library on Tailwind CSS) + custom WoW-raid theme
- state: **Pinia** (`@pinia/nuxt`)
- data: **`$fetch` / `useFetch`** (ofetch) with a configured instance
- realtime: native **`EventSource`** (SSE), matching the backend
- config: Nuxt **`runtimeConfig`**
- package manager: npm

## Rendering / Deploy / Auth Model (the decisive choice)

**Client-rendered Nuxt, deployed on a Node runtime, with the Nitro `server/` as a BFF proxy to the Go backend. The JWT lives in an httpOnly cookie.**

- the browser talks ONLY to Nuxt (same origin) → **no CORS**
- Nitro proxies API calls to the Go backend and attaches the bearer **server-side**
- the JWT is in an **httpOnly cookie** → never readable by JS → no XSS token theft
- client rendering (no SSR hydration of authed pages) keeps auth simple; Nitro is a proxy, not full SSR

This is why Nuxt over plain Vue: the Nitro BFF is the security + architecture win.

```
browser ──(httpOnly cookie, same origin)──> Nuxt/Nitro server ──(Bearer)──> Go backend
```

## Backend API Contract (the seam)

Stable contract the frontend builds against, independent of which endpoints exist yet.

Envelope (every JSON response):

```json
{ "data": <payload|[]|null>, "pagination": {...}|null, "error": { "status": false, "msg": "", "code": 0 } }
```

- success: 2xx, `error.status=false`, payload in `data`
- failure: real HTTP status (401/403/404/409/500, not blanket-400), `error.status=true`, message in `error.msg`
- list endpoints carry `pagination`

Auth: JWT bearer, two contexts (player / admin). The browser never holds the token — Nitro stores it in the httpOnly cookie at login and attaches it to proxied calls.

Server prefixes: `/api/v1/auth`, `/api/v1/client/*`, `/api/v1/internal/*`. Realtime: SSE per session (proxied through Nitro).

## Folder Structure (Nuxt conventions)

```
app.vue / app/             root + layouts
pages/                     file-based routes (auto-generated router)
  index.vue, login.vue, profile.vue, s/[code].vue, admin/...
layouts/                   shared shells (default, admin)
components/                auto-imported UI (Nuxt UI + custom)
composables/               auto-imported logic (useAuth, useApi, ...)
stores/                    Pinia stores per domain
middleware/                route middleware (auth tiers)
server/                    Nitro: BFF proxy routes + cookie/session handling
  api/                     /api/* proxied to Go, attaching the bearer
  middleware/              server-side auth/cookie checks
plugins/                   app-level setup (ofetch instance, ...)
lib/ or utils/             framework-free helpers (money, format)
assets/ styles/            tailwind entry + theme tokens
types/                     shared TS types / API DTOs
nuxt.config.ts             modules, runtimeConfig, ssr flag
app.config.ts              Nuxt UI theme config
```

Rules:
- API calls go through a configured `$fetch` instance / `api/` composables, never raw `fetch` in a component
- the Go backend is reached only via Nitro `server/api/*` proxy routes (BFF)
- shared state in `stores/`; pure helpers framework-free in `lib/`/`utils/`
- DTOs typed in `types/`, matching the backend contract

## Layering

```
page  ->  store / composable  ->  $fetch (/api proxy)  ->  Nitro server  ->  Go backend
  \-> components (Nuxt UI + custom, props in / events out)
```

## Companion Skills

To be (re)built for this Nuxt stack — earlier plain-Vue skills are superseded:
- structure (Nuxt folders, auto-imports)
- api-client (`$fetch` instance + Nitro proxy + envelope unwrap + typed DTOs)
- store (Pinia)
- auth (httpOnly cookie via Nitro, `useCookie`, route + server middleware)
- routing (file-based pages, `definePageMeta`, middleware tiers)
- component (Nuxt UI usage + custom component conventions)
- realtime (SSE through Nitro)
- theming (Nuxt UI `app.config` + Tailwind raid theme)

Plus the external **Nuxt UI skill** (`npx skills add nuxt/ui --agent claude-code`, invoked `/nuxt-ui`) for component reference.

## Config / Security

- API base + secrets via `runtimeConfig` (private = server-only, public = client-safe); never in the client bundle
- the JWT is server-side only (httpOnly cookie); the client never sees it
- backend still enforces all authorization; the frontend only gates UI

## Build / Run (after deps installed)

```bash
npm install
npm run dev       # nuxt dev
npm run build     # nuxt build (Node server output)
npm run preview
```

Scaffold base with `npm create nuxt@latest` (then add `@nuxt/ui`, `@pinia/nuxt`). Dependency install is blocked until local disk has space.

## Migration Direction

- old vanilla-JS SPA = UX/behavior reference only, not a code source
- rebuild per module to the new backend contract + these conventions
- order follows the backend: identity (login/profile/characters) first, then session, auction, prebid, money, catalog
