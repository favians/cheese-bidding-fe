# CheeseBid V2 FE — Remaining 7 Modules

Frontend roadmap for finishing V2 migration. Pair each module with backend work in `cheesebidding/.ai/roadmap-7-modules.md`.

Rules:
- use Nuxt pages/stores/composables; no raw backend calls from components
- all API calls through Nitro proxy / typed store/composable
- no inline CSS; add classes to CSS files
- reuse `AdminNav`, `AdminDataTable`, item icon/name components/patterns where possible
- preserve V1 behavior where product did not choose new behavior

## Status snapshot (keep current)

Done since this roadmap was first written (do not re-scope as pending):
- **Admin shell**: shared `AdminNav` (persistent V1-style action bar: Sessions · Players · Money + logout, active-route highlight) on all admin pages.
- **Admin players** (`/admin/players`): search, active/inactive filter, pagination, create, discord edit, active/favorite toggles, password-reset reveal, expandable character management, balance/ledger/incoming/withdrawals drilldown.
- **Wallet** (`/wallet`): balance, ledger, request withdrawal (held on submit), my-withdrawals with status, maintenance notice.
- **Admin money** (`/admin/money`): maintenance toggle, gold rate, queue incoming, confirm/cancel, withdrawal review.
- Backend pairs the auction **close→debit / reopen→refund** spend side; FE bidding results already reflect winners.

Still open V1-parity gaps not captured by the 7 modules below:
- admin prebid ops **not-dropped** + **delete-last-bid** (UI + BE)
- admin **balance-adjustment** UI (manual credit/debit) once BE endpoint exists

"Current state" lines per module may lag reality — trust this snapshot first.

## 1. Player profile + character self-management

Goal: V1-like player profile with self-service character management.

FE scope:
- profile page layout:
  - account summary
  - wallet mini-summary
  - character list
  - add/edit/delete character form
  - password change form
- character UX:
  - class select
  - faction select
  - main/off spec select
  - class/spec visual badges
  - clear validation errors
- state:
  - profile store or existing auth/client store extension
  - typed DTOs
  - optimistic update only where safe
- CSS:
  - V1-like card/table structure
  - match current V2 admin/player theme

Files likely touched:
- `app/pages/profile.vue` or new profile route
- `app/stores/*profile*` / `app/stores/*characters*`
- `app/shared/types/api.ts`
- `app/assets/css/identity.css`

Done when:
- player can manage own characters without admin
- forms recover cleanly after validation failure

## 2. Withdrawals full flow

Goal: player can request withdrawal; admin can review and move status.

FE scope:
- player wallet:
  - withdrawal request form
  - amount validation against available balance
  - destination/payment method fields
  - maintenance-mode disabled state
  - withdrawal history table
- admin:
  - withdrawals table using `AdminDataTable`
  - status filter/search
  - approve/reject/mark paid actions
  - confirmation for money-moving state changes
- labels:
  - pending
  - approved
  - paid
  - rejected/refunded

Files likely touched:
- `app/pages/wallet.vue`
- `app/pages/admin/money.vue`
- money/admin stores
- `app/assets/css/session-admin.css` or money CSS

Done when:
- player request flow works end to end
- admin can process withdrawals without raw IDs/confusing states

## 3. Incoming balances / payout credits

Goal: admin can manage payout credits before they hit wallets.

FE scope:
- incoming balance table:
  - client/Discord
  - amount
  - source/week/event id
  - status
  - note
  - created/confirmed/canceled timestamps
- actions:
  - create manual incoming balance
  - confirm
  - cancel
- filters:
  - status
  - search client/Discord/event id
- if external CheesePayout endpoint restored:
  - add small docs/help panel with endpoint, required headers, payload fields

Files likely touched:
- `app/pages/admin/money.vue`
- admin money store
- shared API types
- admin CSS

Done when:
- admin can see pending credits and safely confirm/cancel them

## 4. Admin money dashboard

Goal: make `/admin/money` useful as operations screen.

FE scope:
- build sections/tabs:
  - Balances
  - Ledger
  - Incoming
  - Withdrawals
  - Settings
- use `AdminDataTable` for each list
- filters:
  - client/Discord search
  - ledger source/type
  - status
  - optional date range
- settings UX:
  - withdrawals maintenance toggle
  - gold-to-dollar rate input
- states:
  - loading skeleton
  - empty state
  - error alert
  - success toast

Files likely touched:
- `app/pages/admin/money.vue`
- `app/stores/admin-money.ts`
- `app/shared/types/api.ts`
- admin CSS

Done when:
- admin can inspect balances, ledger history, incoming credits, withdrawals, and settings from one page

## 5. Finished/session results export

Goal: V1 finished-session helpers/export parity.

FE scope:
- admin session detail or separate finished page:
  - final winners table
  - item icon/name
  - winning player
  - amount
  - status
  - total gold
  - per-player spend
  - canceled/reset indicators
- export/copy:
  - Discord-ready text copy
  - CSV export if requested
  - print-friendly layout if requested
- player-facing:
  - ended session keeps final results visible
  - copy/share not required for player unless requested

Files likely touched:
- `app/pages/admin/sessions/[id].vue`
- result/export helper under `app/utils` or `app/lib`
- CSS for results/export blocks

Done when:
- ended session can replace V1 finished helper workflow

## 6. V1 SQLite → V2 Postgres migration support

Goal: ensure imported V1 data displays correctly in V2 frontend.

FE scope:
- no importer UI by default
- validate pages against migrated data:
  - admin sessions list
  - session detail
  - players table
  - wallet
  - admin money
  - finished results
- if import status UI requested later:
  - dry-run summary page
  - skipped/conflict row table
  - import result report

Files likely touched:
- none unless display bugs appear
- optional admin import report page if requested

Done when:
- migrated V1 records do not break assumptions in FE stores/components

## 7. Legacy cleanup + production hardening

Goal: remove stale UI assumptions and make FE clean to run/deploy.

FE scope:
- remove stale routes/types/components no longer used
- verify all current routes:
  - public login
  - join
  - live play
  - wallet
  - admin login
  - admin sessions
  - session detail
  - players
  - money
- harden auth behavior:
  - expired cookie redirects
  - admin/client token split stays correct
  - forbidden route error is readable
- build/runtime docs:
  - env vars
  - dev command
  - build command
  - preview command
  - backend proxy target
- visual pass:
  - empty states
  - error states
  - mobile layout

Files likely touched:
- `.ai/architecture/architecture.md`
- `README.md` if present
- route middleware
- CSS cleanup files

Done when:
- `pnpm typecheck` and `pnpm build` pass
- clean checkout can run using docs
- no dead UI remains from V1 migration

## Suggested FE execution order

1. Player profile + character self-management
2. Withdrawals full flow
3. Incoming balances / payout credits
4. Admin money dashboard
5. Finished/session results export
6. V1 migration display validation
7. Legacy cleanup + production hardening
