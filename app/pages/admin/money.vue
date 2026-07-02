<script setup lang="ts">
import type { IncomingBalance, IncomingStatus, LedgerEntry, Withdrawal, WithdrawalStatus } from '#shared/types/api'

definePageMeta({ middleware: 'admin' })

const store = useAdminMoneyStore()
const {
  ledger,
  incoming,
  withdrawals,
  ledgerPagination,
  incomingPagination,
  withdrawalPagination,
  maintenance,
  goldRate,
  loading,
  saving,
  error
} = storeToRefs(store)

const rateDraft = ref('0')
const incomingStatusFilter = ref<'all' | IncomingStatus>('all')
const withdrawalStatusFilter = ref<'all' | WithdrawalStatus>('all')
const ledgerTypeFilter = ref<'all' | 'credit' | 'debit'>('all')
const ledgerSourceFilter = ref('all')
const moneySearch = ref('')
const moneyConfirmOpen = ref(false)
const withdrawalNote = ref('')
const moneyConfirm = ref<{
  title: string
  description: string
  confirmLabel: string
  color: 'primary' | 'error' | 'warning' | 'success'
  needsNote?: boolean
  run: () => Promise<void>
} | null>(null)

const incomingStatusItems = ['all', 'pending', 'confirmed', 'cancelled']
const withdrawalStatusItems = ['all', 'pending', 'approved', 'rejected', 'paid']
const ledgerTypeItems = ['all', 'credit', 'debit']
const ledgerSourceItems = ['all', 'incoming_balance', 'withdrawal', 'withdrawal_refund', 'auction_win', 'auction_refund', 'admin_adjustment']
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
  { key: 'note', label: 'Note' },
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
    return rowMatchesMoneySearch(row.client_id, row.amount, row.note)
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

async function moveWithdrawal(id: string, status: WithdrawalStatus) {
  withdrawalNote.value = ''
  moneyConfirm.value = {
    title: 'Update withdrawal',
    description: `Move withdrawal to ${status}?`,
    confirmLabel: `Set ${status}`,
    color: status === 'rejected' ? 'error' : 'warning',
    needsNote: true,
    run: () => store.updateWithdrawal(id, status, withdrawalNote.value)
  }
  moneyConfirmOpen.value = true
}

async function settleIncoming(row: IncomingBalance, action: 'confirm' | 'cancel') {
  moneyConfirm.value = {
    title: action === 'confirm' ? 'Confirm payout' : 'Cancel payout',
    description: `${action === 'confirm' ? 'Confirm' : 'Cancel'} payout ${row.amount} for client ${row.client_id}?`,
    confirmLabel: action === 'confirm' ? 'Confirm payout' : 'Cancel payout',
    color: action === 'confirm' ? 'success' : 'error',
    run: () => store.settleIncoming(row.id, action)
  }
  moneyConfirmOpen.value = true
}

async function confirmMoneyAction() {
  const action = moneyConfirm.value
  if (!action) return
  await action.run()
  moneyConfirmOpen.value = false
  moneyConfirm.value = null
  withdrawalNote.value = ''
}
</script>

<template>
  <main class="public-shell">
    <AdminNav
      title="Money"
      subtitle="Payouts, withdrawals & settings"
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
        <template #cell-note="{ row }">
          <span class="admin-money-muted">{{ (row as IncomingBalance).note || '—' }}</span>
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

    <UModal
      v-model:open="moneyConfirmOpen"
      :title="moneyConfirm?.title || 'Confirm action'"
      :description="moneyConfirm?.description || ''"
    >
      <template #body>
        <UFormField
          v-if="moneyConfirm?.needsNote"
          label="Admin note"
        >
          <UInput
            v-model="withdrawalNote"
            class="w-full"
            placeholder="optional"
          />
        </UFormField>
      </template>
      <template #footer>
        <div class="session-end-confirm-actions">
          <UButton
            color="neutral"
            variant="outline"
            label="Cancel"
            @click="moneyConfirmOpen = false"
          />
          <UButton
            :color="moneyConfirm?.color || 'primary'"
            :label="moneyConfirm?.confirmLabel || 'Confirm'"
            :loading="saving"
            @click="confirmMoneyAction"
          />
        </div>
      </template>
    </UModal>
  </main>
</template>
