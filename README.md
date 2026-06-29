# CheeseBidding FE

Separated Nuxt frontend for CheeseBidding V2.

## Status

Implemented:

- client login
- player profile + password change + character CRUD
- player wallet + ledger + withdrawals
- play join-by-code
- live auction/prebid bidding with SSE updates
- bid/prebid tabs
- admin login
- admin sessions table + session detail control panel
- admin player management + characters + balance drilldown + manual balance adjustment
- admin money dashboard
- shared admin navigation and `AdminDataTable`

## Local URLs

```text
FE: http://localhost:3000
BE: http://localhost:8081
```

Pages:

```text
/                    client login
/profile             player profile
/wallet              player wallet
/play                join by code
/play/[id]           live bidding
/admin/login         admin login
/admin               sessions
/admin/sessions/[id] session control
/admin/players       player management
/admin/money         money dashboard
```

## Local accounts

```text
admin:  admin / admin123
player: player / player123
player2: player2 / player123
```

## Environment

Nuxt proxies `/api/v1/**` to backend.

Cookies:

```text
cb_token        client JWT
cb_admin_token  admin/internal JWT
```

## Setup

```bash
pnpm install
pnpm dev
```

Build:

```bash
pnpm typecheck
pnpm build
```

Preview:

```bash
pnpm preview
```

## Manual test path

1. Start BE on `localhost:8081`.
2. Start FE on `localhost:3000`.
3. Login admin at `/admin/login`.
4. Create/open session.
5. Login player at `/`, join with code at `/play`.
6. Bid/prebid live.
7. Close auction in admin.
8. Verify wallet ledger debit/refund behavior.

## Styling rules

- No inline CSS.
- Page/component styles go through existing CSS files under `app/assets/css`.
- Reuse `AdminDataTable` for admin tables.
