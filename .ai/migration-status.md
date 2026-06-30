# CheeseBid V2 FE — Migration Status

Separated Nuxt FE for CheeseBid V2. V1 monolith migration is functionally complete at module level.

## Migrated modules

- client login, admin login, auth cookies through Nitro BFF
- player profile: password change + character CRUD
- player wallet: balance, ledger, withdrawal request/history
- player bidding: join by code, Bid/Prebid tabs, SSE live updates, outbid feedback
- admin shell: shared `AdminNav`
- admin sessions: table list, row-click detail, copy join URL, create session with faction/date/instances
- admin session detail: instance picker, auction/prebid controls, finished summary, copy Discord, CSV
- admin players: client CRUD, character management, balance drilldown, manual adjustment
- admin money: balances, ledger, incoming payouts, withdrawals, settings
- CheesePayout UI/docs: external endpoint help panel
- production proxy: `/api/v1/**` and `/api/external/**` through Nitro

## Current hardening status

- auth 401 handling clears correct local store and redirects to login
- imported-data guards tolerate null/invalid dates and timers
- ended-session UI disables new auction/prebid, live close/reset, and player bidding
- cancel/refund cleanup remains available
- admin money and player wallet lists are paginated; FE no longer fetches full money ledger/incoming/withdrawal tables
- CSS rule remains: no inline CSS; use stylesheet files

## Remaining work

No known missing FE functional module.

Remaining work is UI/QA:

1. full V1 visual parity pass page-by-page
2. browser QA with imported data after UI cleanup
3. mobile/responsive pass
4. optional product polish: more export formats, print-friendly finished page, import report UI

## Validation

Use:

```bash
pnpm typecheck
pnpm build
```
