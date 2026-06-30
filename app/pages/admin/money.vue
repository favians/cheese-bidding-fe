<script setup lang="ts">
import type { Balance, CreateIncomingRequest, IncomingBalance, IncomingStatus, LedgerEntry, Withdrawal, WithdrawalStatus } from '#shared/types/api'

definePageMeta({ middleware: 'admin' })

const store = useAdminMoneyStore()
const {
  balances,
  ledger,
  incoming,
  withdrawals,
  balancePagination,
  ledgerPagination,
  incomingPagination,
  withdrawalPagination,
  maintenance,
  goldRate,
  loading,
  saving,
  error
} = storeToRefs(store)

const form = reactive<CreateIncomingRequest>({ client_id: 0, amount: 0, week_id: '', note: '' })
const rateDraft = ref('0')
const incomingStatusFilter = ref<'all' | IncomingStatus>('all')
const withdrawalStatusFilter = ref<'all' | WithdrawalStatus>('all')
const ledgerTypeFilter = ref<'all' | 'credit' | 'debit'>('all')
const ledgerSourceFilter = ref('all')
const moneySearch = ref('')

const incomingStatusItems = ['all', 'pending', 'confirmed', 'cancelled']
const withdrawalStatusItems = ['all', 'pending', 'approved', 'rejected', 'paid']
const ledgerTypeItems = ['all', 'credit', 'debit']
const ledgerSourceItems = ['all', 'incoming_balance', 'withdrawal', 'withdrawal_refund', 'auction_win', 'auction_refund', 'admin_adjustment', 'cheesepayout_item']
const externalIncomingPayload = `{
  "discordId": "123456789012345678",
  "weekId": "2026-W26",
  "amount": 25000,
  "note": "CheesePayout week payout"
}`
const externalItemDebitPayload = `{
  "discordId": "123456789012345678",
  "eventId": "week-2026-W26-item-123",
  "amount": 5000,
  "itemName": "Warglaive of Azzinoth",
  "sessionSnapshot": "Friday 26 June 2026"
}`
const balanceColumns = [
  { key: 'client_id', label: 'Client' },
  { key: 'balance_amount', label: 'Balance' }
]
const ledgerColumns = [
  { key: 'client_id', label: 'Client' },
  { key: 'source', label: 'Source' },
  { key: 'type', label: 'Type' },
  { key: 'amount', label: 'Amount' },
  { key: 'balance_after', label: 'After' },
  { key: 'note', label: 'Note' },
  { key: 'created_at', label: 'Created' }
]
const incomingColumns = [
  { key: 'client_id', label: 'Client' },
  { key: 'amount', label: 'Amount' },
  { key: 'week_id', label: 'Week' },
  { key: 'status', label: 'Status' },
  { key: 'created_at', label: 'Created' },
  { key: 'actions', label: 'Actions' }
]
const withdrawalColumns = [
  { key: 'client_id', label: 'Client' },
  { key: 'amount', label: 'Amount' },
  { key: 'payment_method', label: 'Method' },
  { key: 'status', label: 'Status' },
  { key: 'admin_note', label: 'Admin note' },
  { key: 'created_at', label: 'Created' },
  { key: 'actions', label: 'Actions' }
]

onMounted(async () => {
  await loadMoney()
  rateDraft.value = goldRate.value
})

watch([ledgerSourceFilter, ledgerTypeFilter], () => {
  store.loadLedger(1, ledgerSourceFilter.value, ledgerTypeFilter.value)
})

watch(incomingStatusFilter, () => {
  store.loadIncoming(1, incomingStatusFilter.value)
})

watch(withdrawalStatusFilter, () => {
  store.loadWithdrawals(1, withdrawalStatusFilter.value)
})

const incomingStatusColor: Record<IncomingStatus, 'warning' | 'success' | 'neutral'> = {
  pending: 'warning',
  confirmed: 'success',
  cancelled: 'neutral'
}

const statusColor: Record<WithdrawalStatus, 'warning' | 'info' | 'error' | 'success'> = {
  pending: 'warning',
  approved: 'info',
  rejected: 'error',
  paid: 'success'
}

const filteredBalances = computed(() => {
  return balances.value.filter(row => rowMatchesMoneySearch(row.client_id, row.balance_amount))
})

const filteredLedger = computed(() => {
  return ledger.value.filter((row) => {
    return rowMatchesMoneySearch(row.client_id, row.source, row.type, row.amount, row.balance_after, row.note, row.session_snapshot)
  })
})

// allowed next states from each withdrawal status
function nextStates(status: WithdrawalStatus): WithdrawalStatus[] {
  if (status === 'pending') return ['approved', 'rejected']
  if (status === 'approved') return ['paid', 'rejected']
  return []
}

const filteredIncoming = computed(() => {
  return incoming.value.filter((row) => {
    return rowMatchesMoneySearch(row.client_id, row.amount, row.week_id, row.note)
  })
})

const filteredWithdrawals = computed(() => {
  return withdrawals.value.filter((row) => {
    return rowMatchesMoneySearch(row.client_id, row.amount, row.payment_method, row.note, row.admin_note)
  })
})

async function loadMoney() {
  await store.load({
    ledgerSource: ledgerSourceFilter.value,
    ledgerType: ledgerTypeFilter.value,
    incomingStatus: incomingStatusFilter.value,
    withdrawalStatus: withdrawalStatusFilter.value
  })
}

function loadBalancePage(page: number) {
  return store.loadBalances(page)
}

function loadLedgerPage(page: number) {
  return store.loadLedger(page, ledgerSourceFilter.value, ledgerTypeFilter.value)
}

function loadIncomingPage(page: number) {
  return store.loadIncoming(page, incomingStatusFilter.value)
}

function loadWithdrawalPage(page: number) {
  return store.loadWithdrawals(page, withdrawalStatusFilter.value)
}

function rowMatchesMoneySearch(...values: Array<string | number | undefined>) {
  const needle = moneySearch.value.trim().toLowerCase()
  if (!needle) return true
  return values.some(value => String(value ?? '').toLowerCase().includes(needle))
}

function formatMoney(value: string | number) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return String(value)
  return numeric.toLocaleString('en-US')
}

function moneyTone(value: string | number) {
  return Number(value) < 0 ? 'admin-money-amount admin-money-amount--debit' : 'admin-money-amount admin-money-amount--credit'
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

async function submitIncoming() {
  if (!form.client_id || !form.amount || form.amount <= 0) return
  try {
    await store.createIncoming({ ...form })
    form.amount = 0
    form.note = ''
  } catch {
    // store exposes error
  }
}

async function moveWithdrawal(id: string, status: WithdrawalStatus) {
  const note = window.prompt(`Admin note for "${status}" (optional)`) ?? ''
  if (!window.confirm(`Move withdrawal to ${status}?`)) return
  try {
    await store.updateWithdrawal(id, status, note)
  } catch {
    // store exposes error
  }
}

async function settleIncoming(row: IncomingBalance, action: 'confirm' | 'cancel') {
  if (!window.confirm(`${action === 'confirm' ? 'Confirm' : 'Cancel'} payout ${row.amount} for client ${row.client_id}?`)) return
  try {
    await store.settleIncoming(row.id, action)
  } catch {
    // store exposes error
  }
}
</script>

<template>
  <main class="public-shell">
    <AdminNav
      title="Money"
      subtitle="Payouts, withdrawals & settings"
    />

    <UAlert
      v-if="error"
      color="error"
      variant="soft"
      icon="i-lucide-circle-alert"
      :title="error"
      class="mb-4"
    />

    <!-- Settings -->
    <UCard class="profile-hero-card mb-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <USwitch
            :model-value="maintenance"
            @update:model-value="store.setMaintenance($event)"
          />
          <span>Withdrawals maintenance {{ maintenance ? 'ON (closed)' : 'OFF (open)' }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm opacity-70">Gold→$ rate</span>
          <UInput
            v-model="rateDraft"
            class="w-28"
            placeholder="0"
          />
          <UButton
            size="sm"
            variant="soft"
            label="Save"
            @click="store.setGoldRate(rateDraft)"
          />
        </div>
      </div>
    </UCard>

    <!-- Queue a payout -->
    <UCard class="public-login-card mb-6">
      <form
        class="login-form"
        @submit.prevent="submitIncoming"
      >
        <h2 class="text-base font-semibold">
          Queue incoming payout
        </h2>
        <div class="grid grid-cols-3 gap-3">
          <UFormField
            label="Client ID"
            required
          >
            <UInput
              v-model.number="form.client_id"
              type="number"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Amount"
            required
          >
            <UInput
              v-model.number="form.amount"
              type="number"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Week">
            <UInput
              v-model="form.week_id"
              class="w-full"
              placeholder="e.g. 2026-W26"
            />
          </UFormField>
        </div>
        <UFormField label="Note">
          <UInput
            v-model="form.note"
            class="w-full"
            placeholder="optional"
          />
        </UFormField>
        <UButton
          type="submit"
          label="Queue payout"
          icon="i-lucide-plus"
          block
          class="justify-center"
          :loading="saving"
        />
      </form>
    </UCard>

    <!-- External CheesePayout integration -->
    <UCard class="admin-money-external-card mb-6">
      <div class="admin-money-external-header">
        <div>
          <p>CheesePayout integration</p>
          <h2>External wallet sync endpoints</h2>
        </div>
        <UBadge
          color="success"
          variant="soft"
        >
          V1 compatible
        </UBadge>
      </div>

      <div class="admin-money-external-grid">
        <div class="admin-money-external-block">
          <span>Incoming payout queue</span>
          <code>POST /api/external/incoming-balances</code>
          <code>POST /api/v1/external/incoming-balances</code>
          <p>Creates pending payout rows. Admin confirmation credits the wallet. Duplicate Discord ID + week ID is safe.</p>
          <pre>{{ externalIncomingPayload }}</pre>
        </div>

        <div class="admin-money-external-block">
          <span>Item debit sync</span>
          <code>POST /api/external/item-debits</code>
          <code>POST /api/v1/external/item-debits</code>
          <p>CheesePayout sends a positive amount. V2 stores a negative ledger row with source <strong>cheesepayout_item</strong>. Duplicate event ID is safe.</p>
          <pre>{{ externalItemDebitPayload }}</pre>
        </div>
      </div>

      <div class="admin-money-external-note">
        <UIcon name="i-lucide-key-round" />
        <span>
          Required header: <strong>X-Cheese-Signature</strong>.
          Signature must be <strong>hex(hmac_sha256(minified_json_body, INCOMING_BALANCE_API_SECRET))</strong>;
          <strong>sha256=&lt;hex&gt;</strong> is also accepted.
        </span>
      </div>
    </UCard>

    <!-- Balances -->
    <section class="admin-money-section">
      <AdminDataTable
        :rows="filteredBalances"
        :columns="balanceColumns"
        row-key="client_id"
      >
        <template #header>
          <div class="admin-money-table-header">
            <div>
              <h2>Client balances</h2>
              <span>{{ filteredBalances.length }} shown on this page</span>
            </div>
            <div class="admin-money-filters">
              <UInput
                v-model="moneySearch"
                icon="i-lucide-search"
                placeholder="Search client, amount, note"
              />
            </div>
          </div>
        </template>

        <template #cell-client_id="{ row }">
          <strong>Client {{ (row as Balance).client_id }}</strong>
        </template>
        <template #cell-balance_amount="{ row }">
          <span :class="moneyTone((row as Balance).balance_amount)">
            {{ formatMoney((row as Balance).balance_amount) }}
          </span>
        </template>
      </AdminDataTable>
      <AdminPagination
        :pagination="balancePagination"
        :loading="loading"
        @change="loadBalancePage"
      />
    </section>

    <!-- Ledger -->
    <section class="admin-money-section">
      <AdminDataTable
        :rows="filteredLedger"
        :columns="ledgerColumns"
        row-key="id"
      >
        <template #header>
          <div class="admin-money-table-header">
            <div>
              <h2>Balance ledger</h2>
              <span>{{ filteredLedger.length }} shown on this page</span>
            </div>
            <div class="admin-money-filters">
              <USelect
                v-model="ledgerSourceFilter"
                :items="ledgerSourceItems"
              />
              <USelect
                v-model="ledgerTypeFilter"
                :items="ledgerTypeItems"
              />
            </div>
          </div>
        </template>

        <template #cell-client_id="{ row }">
          <strong>Client {{ (row as LedgerEntry).client_id }}</strong>
        </template>
        <template #cell-source="{ row }">
          <span class="admin-money-muted">{{ (row as LedgerEntry).source }}</span>
        </template>
        <template #cell-type="{ row }">
          <UBadge
            :color="(row as LedgerEntry).type === 'credit' ? 'success' : 'error'"
            variant="soft"
          >
            {{ (row as LedgerEntry).type }}
          </UBadge>
        </template>
        <template #cell-amount="{ row }">
          <span :class="moneyTone((row as LedgerEntry).amount)">
            {{ formatMoney((row as LedgerEntry).amount) }}
          </span>
        </template>
        <template #cell-balance_after="{ row }">
          {{ formatMoney((row as LedgerEntry).balance_after) }}
        </template>
        <template #cell-note="{ row }">
          <span class="admin-money-muted">{{ (row as LedgerEntry).note || (row as LedgerEntry).session_snapshot || '—' }}</span>
        </template>
        <template #cell-created_at="{ row }">
          {{ formatDate((row as LedgerEntry).created_at) }}
        </template>
      </AdminDataTable>
      <AdminPagination
        :pagination="ledgerPagination"
        :loading="loading"
        @change="loadLedgerPage"
      />
    </section>

    <!-- Incoming payouts -->
    <section class="admin-money-section">
      <AdminDataTable
        :rows="filteredIncoming"
        :columns="incomingColumns"
        row-key="id"
      >
        <template #header>
          <div class="admin-money-table-header">
            <div>
              <h2>Incoming payouts</h2>
              <span>{{ filteredIncoming.length }} shown on this page</span>
            </div>
            <div class="admin-money-filters">
              <UInput
                v-model="moneySearch"
                icon="i-lucide-search"
                placeholder="Search client, amount, note"
              />
              <USelect
                v-model="incomingStatusFilter"
                :items="incomingStatusItems"
              />
            </div>
          </div>
        </template>

        <template #cell-client_id="{ row }">
          <strong>Client {{ (row as IncomingBalance).client_id }}</strong>
        </template>
        <template #cell-amount="{ row }">
          <span class="admin-money-amount">+{{ formatMoney((row as IncomingBalance).amount) }}</span>
        </template>
        <template #cell-week_id="{ row }">
          {{ (row as IncomingBalance).week_id || '—' }}
        </template>
        <template #cell-status="{ row }">
          <UBadge
            :color="incomingStatusColor[(row as IncomingBalance).status]"
            variant="soft"
          >
            {{ (row as IncomingBalance).status }}
          </UBadge>
        </template>
        <template #cell-created_at="{ row }">
          {{ formatDate((row as IncomingBalance).created_at) }}
        </template>
        <template #cell-actions="{ row }">
          <div
            v-if="(row as IncomingBalance).status === 'pending'"
            class="admin-money-actions"
          >
            <UTooltip text="Confirm payout and credit balance">
              <UButton
                size="xs"
                color="success"
                variant="soft"
                icon="i-lucide-check"
                :loading="saving"
                aria-label="Confirm payout"
                @click="settleIncoming(row as IncomingBalance, 'confirm')"
              />
            </UTooltip>
            <UTooltip text="Cancel payout">
              <UButton
                size="xs"
                color="error"
                variant="soft"
                icon="i-lucide-x"
                :loading="saving"
                aria-label="Cancel payout"
                @click="settleIncoming(row as IncomingBalance, 'cancel')"
              />
            </UTooltip>
          </div>
          <span
            v-else
            class="admin-money-muted"
          >No action</span>
        </template>
      </AdminDataTable>
      <AdminPagination
        :pagination="incomingPagination"
        :loading="loading"
        @change="loadIncomingPage"
      />
    </section>

    <!-- Withdrawals -->
    <section class="admin-money-section">
      <AdminDataTable
        :rows="filteredWithdrawals"
        :columns="withdrawalColumns"
        row-key="id"
      >
        <template #header>
          <div class="admin-money-table-header">
            <div>
              <h2>Withdrawals</h2>
              <span>{{ filteredWithdrawals.length }} shown on this page</span>
            </div>
            <div class="admin-money-filters">
              <USelect
                v-model="withdrawalStatusFilter"
                :items="withdrawalStatusItems"
              />
            </div>
          </div>
        </template>

        <template #cell-client_id="{ row }">
          <strong>Client {{ (row as Withdrawal).client_id }}</strong>
        </template>
        <template #cell-amount="{ row }">
          <span class="admin-money-amount">-{{ formatMoney((row as Withdrawal).amount) }}</span>
        </template>
        <template #cell-payment_method="{ row }">
          {{ (row as Withdrawal).payment_method || '—' }}
        </template>
        <template #cell-status="{ row }">
          <UBadge
            :color="statusColor[(row as Withdrawal).status]"
            variant="soft"
          >
            {{ (row as Withdrawal).status }}
          </UBadge>
        </template>
        <template #cell-admin_note="{ row }">
          <span class="admin-money-muted">{{ (row as Withdrawal).admin_note || '—' }}</span>
        </template>
        <template #cell-created_at="{ row }">
          {{ formatDate((row as Withdrawal).created_at) }}
        </template>
        <template #cell-actions="{ row }">
          <div
            v-if="nextStates((row as Withdrawal).status).length"
            class="admin-money-actions"
          >
            <UTooltip
              v-for="s in nextStates((row as Withdrawal).status)"
              :key="s"
              :text="`Move to ${s}`"
            >
              <UButton
                size="xs"
                :color="s === 'rejected' ? 'error' : s === 'paid' ? 'success' : 'primary'"
                variant="soft"
                :icon="s === 'rejected' ? 'i-lucide-x' : s === 'paid' ? 'i-lucide-send' : 'i-lucide-check'"
                :loading="saving"
                :aria-label="`Move withdrawal to ${s}`"
                @click="moveWithdrawal((row as Withdrawal).id, s)"
              />
            </UTooltip>
          </div>
          <span
            v-else
            class="admin-money-muted"
          >No action</span>
        </template>
      </AdminDataTable>
      <AdminPagination
        :pagination="withdrawalPagination"
        :loading="loading"
        @change="loadWithdrawalPage"
      />
    </section>
  </main>
</template>
