# CheeseBidding FE

Nuxt frontend for CheeseBidding V2. This repo is the separated frontend replacement for the old `cheesebid` monolith UI.

## Current Status

Implemented screens/features:

- client login
- client profile
- client characters
- admin login
- admin dashboard
- admin sessions
- session detail/play screens
- auction flow integration
- item catalog picker integration

Relevant current files:

- `app/pages/index.vue` — client login
- `app/pages/admin/login.vue` — admin login
- `app/pages/admin/index.vue` — admin dashboard
- `app/pages/admin/sessions/[id].vue` — admin session detail
- `app/pages/play/[id].vue` — client play/session page
- `app/components/ItemPicker.vue` — item catalog picker
- `app/stores/catalog.ts` — item catalog API store
- `app/stores/admin-auth.ts` — admin auth store
- `app/stores/auth.ts` — client auth store
- `server/api/v1/[...path].ts` — backend API proxy

## Local URLs

Frontend:

```text
http://localhost:3000
```

Client login page:

```text
http://localhost:3000/
```

Admin login page:

```text
http://localhost:3000/admin/login
```

Admin dashboard:

```text
http://localhost:3000/admin
```

Backend expected by FE:

```text
http://localhost:8081
```

## Local Test Accounts

Client login:

```text
username: admin
password: admin
```

Admin login:

```text
username: admin
password: admin
```

## Environment

Nuxt runtime config uses backend base URL from config/env. For local dev, point backend to:

```text
http://localhost:8081
```

Auth cookies:

```text
cb_token        client JWT
cb_admin_token  admin/internal JWT
```

Internal backend routes use `cb_admin_token`; client backend routes use `cb_token`.

## Setup

Install dependencies:

```bash
pnpm install
```

Start dev server:

```bash
pnpm dev
```

Build:

```bash
pnpm build
```

Preview production build:

```bash
pnpm preview
```

## Item Catalog

Item catalog API is available through the proxy:

Client:

```text
GET /api/v1/client/items
GET /api/v1/client/items/{id}
```

Admin:

```text
GET    /api/v1/internal/items
POST   /api/v1/internal/items
GET    /api/v1/internal/items/{id}
DELETE /api/v1/internal/items/{id}
```

Use item picker from:

```text
app/components/ItemPicker.vue
```

Store:

```text
app/stores/catalog.ts
```

## Verification

Run frontend checks:

```bash
pnpm typecheck
pnpm build
```

Use browser test path:

1. Start backend on `localhost:8081`.
2. Start FE on `localhost:3000`.
3. Open `/admin/login`.
4. Login with `admin/admin`.
5. Open admin session screen.
6. Test item picker and auction creation.
