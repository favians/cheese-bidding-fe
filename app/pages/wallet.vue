<script setup lang="ts">
import type { CreateWithdrawalRequest, WithdrawalStatus, LedgerEntry } from '#shared/types/api'

definePageMeta({ middleware: 'auth' })

const wallet = useWalletStore()
const {
  balance,
  incoming,
  ledger,
  withdrawals,
  incomingPagination,
  ledgerPagination,
  withdrawalPagination,
  config,
  loading,
  submitting,
  error
} = storeToRefs(wallet)

const form = reactive<CreateWithdrawalRequest>({ amount: 0, payment_method: '', note: '' })
const maintenanceModalOpen = ref(false)

onMounted(() => wallet.load())

const maintenance = computed(() => config.value?.maintenance_mode ?? false)

watch(maintenance, (value) => {
  if (value) maintenanceModalOpen.value = true
}, { immediate: true })
const pendingIncoming = computed(() => {
  const total = incoming.value
    .filter(row => row.status === 'pending')
    .reduce((sum, row) => sum + Number(row.amount || 0), 0)
  return Number.isFinite(total) ? total : 0
})

const statusColor: Record<WithdrawalStatus, 'warning' | 'info' | 'error' | 'success'> = {
  pending: 'warning',
  approved: 'info',
  rejected: 'error',
  paid: 'success'
}

function ledgerSourceLabel(entry: LedgerEntry) {
  if (entry.source === 'auction_win') return 'Auction win'
  if (entry.source === 'auction_refund') return 'Auction refund'
  if (entry.source === 'incoming_balance') return 'Payout'
  if (entry.source === 'withdrawal') return 'Withdrawal'
  if (entry.source === 'withdrawal_refund') return 'Withdrawal refund'
  return entry.source
}

function ledgerAmountClass(entry: LedgerEntry) {
  return entry.type === 'credit' ? 'wallet-money wallet-money--credit' : 'wallet-money wallet-money--debit'
}

function formatMoney(value: string | number) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return String(value)
  return numeric.toLocaleString('en-US')
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

function incomingStatusColor(status: string) {
  if (status === 'pending') return 'warning'
  if (status === 'confirmed') return 'success'
  return 'neutral'
}

async function submit() {
  if (!form.amount || form.amount <= 0 || !form.payment_method.trim()) return
  try {
    await wallet.requestWithdrawal({ ...form })
    form.amount = 0
    form.note = ''
  } catch {
    // store exposes error
  }
}
</script>

<template>
  <main class="public-shell">
    <header class="topbar">
      <div class="brand">
        <div class="brand-head">
          <span class="brand-logo">🧀 Cheese GDKP</span>
        </div>
        <h1>Wallet</h1>
        <p>Balance, payouts & withdrawals</p>
      </div>
      <UButton
        color="neutral"
        variant="ghost"
        icon="i-lucide-gavel"
        label="Bidding"
        to="/play"
      />
    </header>

    <section class="wallet-content-panel">
      <div class="wallet-section-heading">
        <span>Balance</span>
        <h2>Balance Information</h2>
      </div>

      <div class="wallet-balance-summary">
        <article class="wallet-balance-card">
          <span>Current Balance</span>
          <strong :class="Number(balance) < 0 ? 'wallet-money--debit' : 'wallet-money--credit'">
            {{ formatMoney(balance) }}
          </strong>
          <small>{{ Number(balance) < 0 ? 'Amount owed' : 'Available credit' }}</small>
        </article>
        <article class="wallet-info-card">
          <span>Incoming</span>
          <strong :class="pendingIncoming > 0 ? 'wallet-money--incoming' : ''">
            {{ formatMoney(pendingIncoming) }}
          </strong>
          <small>Known payout not added yet. Becomes real balance after admin confirms payment.</small>
        </article>
      </div>

      <section class="wallet-history-card">
        <div class="wallet-card-head">
          <h2>Incoming Balance</h2>
          <span>Pending {{ formatMoney(pendingIncoming) }}</span>
        </div>

        <div
          v-if="loading && !incoming.length"
          class="wallet-empty"
        >
          Loading…
        </div>
        <div
          v-else-if="!incoming.length"
          class="wallet-empty"
        >
          No incoming balance yet.
        </div>
        <div
          v-else
          class="wallet-table wallet-incoming-table"
        >
          <div class="wallet-table-row wallet-table-head wallet-incoming-row">
            <span>Amount</span>
            <span>Week</span>
            <span>Status</span>
            <span>Note</span>
            <span>Created</span>
          </div>
          <div
            v-for="row in incoming"
            :key="row.id"
            class="wallet-table-row wallet-incoming-row"
          >
            <strong class="wallet-money wallet-money--credit">{{ formatMoney(row.amount) }}</strong>
            <span>{{ row.week_id || '—' }}</span>
            <span>
              <UBadge
                :color="incomingStatusColor(row.status)"
                variant="soft"
              >
                {{ row.status }}
              </UBadge>
            </span>
            <span>{{ row.note || '—' }}</span>
            <time>{{ formatDate(row.created_at) }}</time>
          </div>
        </div>
        <AdminPagination
          :pagination="incomingPagination"
          :loading="loading"
          @change="wallet.loadIncoming"
        />
      </section>

      <section class="wallet-history-card">
        <div class="wallet-card-head">
          <h2>Balance History</h2>
        </div>

        <div
          v-if="loading && !ledger.length"
          class="wallet-empty"
        >
          Loading…
        </div>
        <div
          v-else-if="!ledger.length"
          class="wallet-empty"
        >
          No balance history yet.
        </div>
        <div
          v-else
          class="wallet-table wallet-ledger-table"
        >
          <div class="wallet-table-row wallet-table-head wallet-ledger-row">
            <span>Amount</span>
            <span>Type</span>
            <span>Session</span>
            <span>Note</span>
            <span>After</span>
            <span>Date</span>
          </div>
          <div
            v-for="entry in ledger"
            :key="entry.id"
            class="wallet-table-row wallet-ledger-row"
          >
            <span :class="ledgerAmountClass(entry)">{{ formatMoney(entry.amount) }}</span>
            <span>{{ ledgerSourceLabel(entry) }}</span>
            <span>{{ entry.session_snapshot || '—' }}</span>
            <span>{{ entry.note || entry.source || '—' }}</span>
            <strong>{{ formatMoney(entry.balance_after) }}</strong>
            <time>{{ formatDate(entry.created_at) }}</time>
          </div>
        </div>
        <AdminPagination
          :pagination="ledgerPagination"
          :loading="loading"
          @change="wallet.loadLedger"
        />
      </section>
    </section>

    <UCard
      v-if="!maintenance"
      class="public-login-card mb-6"
    >
      <form
        class="login-form"
        @submit.prevent="submit"
      >
        <h2 class="text-base font-semibold">
          Request withdrawal
        </h2>
        <div class="grid grid-cols-2 gap-3">
          <UFormField
            label="Amount"
            required
          >
            <UInput
              v-model.number="form.amount"
              type="number"
              class="w-full"
              :placeholder="`max ${balance}`"
            />
          </UFormField>
          <UFormField
            label="Payment method"
            required
          >
            <UInput
              v-model="form.payment_method"
              class="w-full"
              placeholder="e.g. PayPal / IGN"
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
          label="Request"
          icon="i-lucide-banknote"
          block
          class="justify-center"
          :loading="submitting"
        />
      </form>
    </UCard>

    <section class="wallet-history-card">
      <div class="wallet-card-head">
        <h2>Withdrawal History</h2>
      </div>
      <div
        v-if="!withdrawals.length"
        class="wallet-empty"
      >
        No withdrawals yet.
      </div>
      <div
        v-else
        class="wallet-table wallet-withdrawal-table"
      >
        <div class="wallet-table-row wallet-table-head wallet-withdrawal-row">
          <span>Amount</span>
          <span>Method</span>
          <span>Status</span>
          <span>Note</span>
          <span>Created</span>
        </div>
        <div
          v-for="wd in withdrawals"
          :key="wd.id"
          class="wallet-table-row wallet-withdrawal-row"
        >
          <strong>{{ formatMoney(wd.amount) }}</strong>
          <span>{{ wd.payment_method }}</span>
          <UBadge
            :color="statusColor[wd.status]"
            variant="soft"
          >
            {{ wd.status }}
          </UBadge>
          <span>{{ wd.note || wd.admin_note || '—' }}</span>
          <time>{{ formatDate(wd.created_at) }}</time>
        </div>
      </div>
      <AdminPagination
        :pagination="withdrawalPagination"
        :loading="loading"
        @change="wallet.loadWithdrawals"
      />
    </section>

    <UModal
      v-model:open="maintenanceModalOpen"
      title="Withdrawals are temporarily closed"
      description="The admin has withdrawals in maintenance. Try again later."
    >
      <template #footer>
        <div class="session-end-confirm-actions">
          <UButton
            color="neutral"
            variant="outline"
            label="Close"
            @click="maintenanceModalOpen = false"
          />
        </div>
      </template>
    </UModal>
  </main>
</template>
