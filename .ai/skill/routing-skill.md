# Routing Skill

Use this when defining or guarding routes in the CheeseBid frontend.

Vue Router maps URLs to views and enforces auth tiers through guards. The route table declares; views render; the auth store decides access.

## Use When

- adding a route / view
- protecting a route by auth tier
- handling redirects, route params, or lazy loading
- changing the navigation guard

Do not use this for: token lifecycle (auth skill), data fetching (api-client/store), layout (component skill).

## Layout

- `router/index.js` — the route table + router instance
- `router/guards.js` — navigation guards

```js
// router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import { authGuard } from './guards'

const routes = [
  { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue') },
  { path: '/profile', name: 'profile', component: () => import('@/views/ProfileView.vue'), meta: { requiresAuth: true } },
  { path: '/s/:code', name: 'session', component: () => import('@/views/SessionView.vue'), meta: { requiresAuth: true } },
  { path: '/admin', name: 'admin', component: () => import('@/views/admin/AdminView.vue'), meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/NotFoundView.vue') },
]

export const router = createRouter({ history: createWebHistory(), routes })
router.beforeEach(authGuard)
```

## Rules

- one route -> one routed view in `views/`; lazy-load views with `() => import(...)`
- declare auth tier with `meta`: `requiresAuth` (player) and `requiresAdmin` (admin)
- a single global `beforeEach` guard reads the auth store and enforces tiers (auth skill)
- name routes and navigate by `name` + `params`, not by hand-built path strings
- route params (`:code`) are read with `useRoute()` in the view; validate/guard missing params
- keep a catch-all `not-found` route last
- mirror the backend audience split: public (`/login`), player (`requiresAuth`), admin (`requiresAdmin`)

## Guard Behavior

- unauthenticated -> redirect to `login` with `?redirect=<target>`; after login, return to it
- authenticated player hitting an admin route -> deny (redirect)
- the guard never fetches; it reads already-loaded auth state (current user is loaded on boot, auth skill)
- avoid guard flicker: the app resolves the boot current-user check before rendering protected views

## Structure / Naming

- routed pages live in `views/`, suffixed `View` (`LoginView.vue`), admin pages under `views/admin/`
- route `name` is kebab or camel and stable; components reference names, not paths
- group nested feature routes with `children` when they share a layout

## Anti-Patterns

- auth logic duplicated in views instead of the guard
- hardcoded `router.push('/s/' + code)` instead of `{ name: 'session', params: { code } }`
- eager-importing every view (bloats the initial bundle); lazy-load
- fetching inside a guard
- protected view rendering before the auth boot check resolves

## Checklist

- route added to `router/index.js`, view lazy-loaded
- auth tier set via `meta` (`requiresAuth`/`requiresAdmin`)
- enforced by the single global guard, which reads the auth store
- navigation by route `name` + `params`
- params read via `useRoute`, missing params handled
- catch-all `not-found` present

If any item fails, the route is not ready.
