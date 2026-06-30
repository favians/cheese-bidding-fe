# CheeseBid V2 FE — Parity Checklist / Remaining Workstreams

Frontend checklist for finishing V2 migration parity. Pair each workstream with backend work in `cheesebidding/.ai/roadmap-7-modules.md`.

This is no longer a literal "7 missing modules" roadmap. The seven sections remain as historical workstreams/checklists, but most core FE module work is implemented.

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
- **Profile** (`/profile`): password change, character CRUD, class/faction/spec selectors, inactive-account guard messaging, wallet shortcut.
- **Admin money** (`/admin/money`): maintenance toggle, gold rate, queue incoming, balances/ledger/incoming/withdrawal `AdminDataTable` views, filters/search, confirm/cancel/approve/reject/paid actions with confirmations.
- Backend pairs the auction **close→debit / reopen→refund** spend side; FE bidding results already reflect winners.
- Player live bidding `/play/[id]` keeps V1 auction-card structure; Prebid tab now matches V1 control shape (input + Outbid, no extra Min button).
- Admin session detail prebid actions now match V1 safer control flow: icon actions, tooltips, confirmations, and delete-latest disabled when bid history cannot be rolled back.

Still open V1-parity gaps not captured by the 7 modules below:
- no big FE module gap known; remaining work is polish/verification.

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

Implemented:
- profile page loads character count immediately
- balance menu opens `/wallet`
- inactive account shows guard messaging
- inactive account disables password and character submit
- password form requires current password before submit

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

Implemented:
- `/admin/money` withdrawals use `AdminDataTable`
- withdrawal status filter and shared search
- approve/reject/paid actions use icon buttons, tooltips, and confirmation

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

Implemented:
- `/admin/money` incoming balances use `AdminDataTable`
- incoming status filter and shared search
- confirm/cancel actions use icon buttons, tooltips, and confirmation

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

Implemented:
- incoming and withdrawals moved from large cards/list rows to themed `AdminDataTable`
- balances and ledger added as themed `AdminDataTable` sections
- ledger filters by source/type plus shared search
- settings remain on same page with maintenance toggle and gold-rate input

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

Implemented:
- admin session Finished tab shows totals, management cut, estimated payout/player, sold/cancelled/open counts
- per-player spend summary uses BE `GET /api/v1/internal/sessions/{id}/summary` when available, with closed-auction FE fallback
- Discord-ready summary copy
- CSV result export

## 6. V1 SQLite → V2 Postgres migration support

Goal: ensure imported V1 data displays correctly in V2 frontend.

Current state:
- V1 import has been applied locally into Postgres with zero skips / zero unsupported rows.
- Admin money balance/ledger endpoints spot-verified after BE restart.
- V1 prebid status `auctioned` is normalized to V2 `resolved`; imported session prebids now match FE `PrebidStatus`.
- Remaining FE work is visual validation across imported sessions, players, money, wallet, and finished result screens.

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

Current state:
- README documents Nuxt runtime env vars, auth cookies, BFF proxy, production preview command, and SSE/proxy notes.
- verified: `pnpm typecheck` and `pnpm build` pass.

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

1. Legacy cleanup + production hardening.
2. Visual validation against imported data.
3. Optional UI/docs only if external CheesePayout/HMAC item-debit endpoint is restored.
4. Broader V1 visual parity pass after functional migration.
