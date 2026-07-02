<script setup lang="ts">
import type {
  Balance,
  BalanceAdjustmentRequest,
  ClientAdmin,
  CreateIncomingRequest,
  IncomingBalance,
  IncomingStatus,
  Item,
  LedgerEntry,
  Pagination,
  Session
} from '#shared/types/api'

definePageMeta({ middleware: 'admin' })

const route = useRoute()
const { request, requestPaged } = useApi()
const toast = useToast()

const clientId = computed(() => Number(route.params.id))
const client = ref<ClientAdmin | null>(null)
const balance = ref<Balance | null>(null)
const ledger = ref<LedgerEntry[]>([])
const incoming = ref<IncomingBalance[]>([])
const adjustmentSessions = ref<Session[]>([])
const ledgerPagination = ref<Pagination | null>(null)
const incomingPagination = ref<Pagination | null>(null)
const loading = ref(false)
const savingAdjustment = ref(false)
const savingIncoming = ref(false)
const error = ref('')
const incomingActionModalOpen = ref(false)
const pendingIncomingAction = ref<{ row: IncomingBalance, action: 'confirm' | 'cancel' } | null>(null)

const adjustmentForm = reactive<BalanceAdjustmentRequest>({
  amount: '',
  reason: '',
  password: '',
  item_name: '',
  item_id: 0,
  item_quality: '',
  instance: '',
  boss: '',
  image: '',
  session_snapshot: ''
})
const incomingForm = reactive<CreateIncomingRequest>({
  client_id: 0,
  amount: 0,
  note: '',
  password: ''
})

const pendingIncoming = computed(() => {
  const total = incoming.value
    .filter(row => row.status === 'pending')
    .reduce((sum, row) => sum + Number(row.amount || 0), 0)
  return Number.isFinite(total) ? total : 0
})
const adjustmentItemName = computed({
  get: () => adjustmentForm.item_name ?? '',
  set: (value: string) => {
    adjustmentForm.item_name = value
  }
})
const adjustmentSessionSnapshot = computed({
  get: () => adjustmentForm.session_snapshot ?? '',
  set: (value: string) => {
    adjustmentForm.session_snapshot = value
  }
})
const adjustmentSessionItems = computed(() => adjustmentSessions.value.map(session => ({
  label: sessionSnapshot(session),
  value: sessionSnapshot(session)
})))

onMounted(() => {
  if (!Number.isFinite(clientId.value) || clientId.value < 1) {
    error.value = 'Invalid player ID'
    return
  }
  incomingForm.client_id = clientId.value
  void loadAll()
  void loadAdjustmentSessions()
})

async function loadAll() {
  loading.value = true
  error.value = ''
  try {
    const [clientRow, balanceRow] = await Promise.all([
      request<ClientAdmin>(`/api/v1/internal/clients/${clientId.value}`),
      request<Balance>(`/api/v1/internal/clients/${clientId.value}/balance`),
      loadIncoming(1),
      loadLedger(1)
    ])
    client.value = clientRow
    balance.value = balanceRow
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Failed to load balance page'
  } finally {
    loading.value = false
  }
}

async function loadIncoming(page = incomingPagination.value?.page ?? 1) {
  const { data, pagination } = await requestPaged<IncomingBalance[]>(`/api/v1/internal/clients/${clientId.value}/incoming-balances`, {
    query: { page: String(page), limit: '10' }
  })
  incoming.value = data ?? []
  incomingPagination.value = pagination
}

async function loadLedger(page = ledgerPagination.value?.page ?? 1) {
  const { data, pagination } = await requestPaged<LedgerEntry[]>(`/api/v1/internal/clients/${clientId.value}/balance/ledger`, {
    query: { page: String(page), limit: '10' }
  })
  ledger.value = data ?? []
  ledgerPagination.value = pagination
}

async function loadAdjustmentSessions() {
  try {
    const { data } = await requestPaged<Session[]>('/api/v1/internal/sessions', {
      query: { page: '1', limit: '10' }
    })
    adjustmentSessions.value = data ?? []
  } catch {
    adjustmentSessions.value = []
  }
}

async function refreshBalance() {
  balance.value = await request<Balance>(`/api/v1/internal/clients/${clientId.value}/balance`)
}

async function submitAdjustment() {
  const amount = adjustmentForm.amount.trim()
  const reason = adjustmentForm.reason.trim()
  const password = adjustmentForm.password.trim()
  if (!amount || !reason || !password || Number(amount) === 0) return
  const itemName = adjustmentForm.item_name?.trim() ?? ''
  savingAdjustment.value = true
  error.value = ''
  try {
    balance.value = await request<Balance>(`/api/v1/internal/clients/${clientId.value}/balance-adjustments`, {
      method: 'POST',
      body: {
        amount,
        reason,
        password,
        item_id: itemName ? adjustmentForm.item_id : 0,
        item_name: itemName,
        item_quality: itemName ? adjustmentForm.item_quality : '',
        instance: itemName ? adjustmentForm.instance : '',
        boss: itemName ? adjustmentForm.boss : '',
        image: itemName ? adjustmentForm.image : '',
        session_snapshot: adjustmentForm.session_snapshot?.trim()
      }
    })
    adjustmentForm.amount = ''
    adjustmentForm.reason = ''
    adjustmentForm.password = ''
    clearAdjustmentItem()
    adjustmentForm.session_snapshot = ''
    await Promise.all([loadLedger(1), refreshBalance()])
    toast.add({
      title: 'Balance adjusted',
      description: `${formatMoney(amount)} adjustment saved`,
      color: 'success',
      icon: 'i-lucide-circle-check'
    })
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Could not adjust balance'
  } finally {
    savingAdjustment.value = false
  }
}

function selectAdjustmentItem(item: Item) {
  adjustmentForm.item_id = item.wow_item_id
  adjustmentForm.item_name = item.name
  adjustmentForm.item_quality = item.quality
  adjustmentForm.instance = item.instance_name
  adjustmentForm.boss = item.boss_name
  adjustmentForm.image = item.icon_path
}

function sessionSnapshot(session: Session) {
  return [session.code, session.title].filter(Boolean).join(' · ')
}

function clearAdjustmentItem() {
  adjustmentForm.item_id = 0
  adjustmentForm.item_name = ''
  adjustmentForm.item_quality = ''
  adjustmentForm.instance = ''
  adjustmentForm.boss = ''
  adjustmentForm.image = ''
}

async function submitIncoming() {
  const password = incomingForm.password?.trim()
  if (!incomingForm.amount || incomingForm.amount <= 0 || !password) return
  const amount = incomingForm.amount
  savingIncoming.value = true
  error.value = ''
  try {
    await request<IncomingBalance>('/api/v1/internal/incoming-balances', {
      method: 'POST',
      body: {
        client_id: clientId.value,
        amount: incomingForm.amount,
        note: incomingForm.note?.trim(),
        password
      }
    })
    incomingForm.amount = 0
    incomingForm.note = ''
    incomingForm.password = ''
    await loadIncoming(1)
    toast.add({
      title: 'Incoming queued',
      description: `${formatMoney(amount)} incoming balance created`,
      color: 'success',
      icon: 'i-lucide-circle-check'
    })
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Could not add incoming balance'
  } finally {
    savingIncoming.value = false
  }
}

function settleIncoming(row: IncomingBalance, action: 'confirm' | 'cancel') {
  pendingIncomingAction.value = { row, action }
  incomingActionModalOpen.value = true
}

async function confirmIncomingAction() {
  const pending = pendingIncomingAction.value
  if (!pending) return
  error.value = ''
  try {
    await request<IncomingBalance>(`/api/v1/internal/incoming-balances/${pending.row.id}/${pending.action}`, { method: 'POST' })
    await Promise.all([loadIncoming(incomingPagination.value?.page ?? 1), loadLedger(1), refreshBalance()])
    toast.add({
      title: pending.action === 'confirm' ? 'Incoming confirmed' : 'Incoming cancelled',
      description: `${formatMoney(pending.row.amount)} ${pending.action === 'confirm' ? 'credited' : 'cancelled'}`,
      color: 'success',
      icon: 'i-lucide-circle-check'
    })
    incomingActionModalOpen.value = false
    pendingIncomingAction.value = null
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : `Could not ${pending.action} incoming balance`
  }
}

function formatMoney(value: string | number | undefined) {
  const numeric = Number(value ?? 0)
  if (!Number.isFinite(numeric)) return String(value ?? 0)
  const formatted = Math.abs(numeric).toLocaleString('en-US')
  return numeric < 0 ? `-$${formatted}` : `$${formatted}`
}

function moneyTone(value: string | number | undefined) {
  return Number(value ?? 0) < 0 ? 'admin-money-amount admin-money-amount--debit' : 'admin-money-amount admin-money-amount--credit'
}

function ledgerSourceLabel(entry: LedgerEntry) {
  if (entry.source === 'auction_win') return 'Auction win'
  if (entry.source === 'auction_refund') return 'Auction refund'
  if (entry.source === 'incoming_balance') return 'Payout'
  if (entry.source === 'withdrawal') return 'Withdrawal'
  if (entry.source === 'withdrawal_refund') return 'Withdrawal refund'
  if (entry.source === 'admin_adjustment') return 'Admin adjustment'
  return entry.source
}

function itemQualityClass(quality?: string) {
  const normalized = String(quality || '').trim().toLowerCase()
  if (!normalized) return ''
  return `quality-item-name quality-item-name--${normalized}`
}

function ledgerItemMeta(entry: LedgerEntry) {
  return [entry.item_instance_name, entry.item_boss_name]
    .filter(Boolean)
    .join(' · ')
}

function incomingStatusColor(status: IncomingStatus): 'warning' | 'success' | 'neutral' {
  if (status === 'pending') return 'warning'
  if (status === 'confirmed') return 'success'
  return 'neutral'
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date)
}
</script>

<template>
  <main class="public-shell">
    <AdminNav
      title="Balance Adjustment"
      :subtitle="client ? client.username : `Player #${clientId}`"
    >
      <template #actions>
        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-arrow-left"
          label="Back to Players"
          to="/admin/players"
        />
      </template>
    </AdminNav>

    <div
      v-if="loading && !client"
      class="wallet-empty"
    >
      Loading…
    </div>

    <section
      v-else
      class="admin-balance-page"
    >
      <div class="admin-balance-page-summary">
        <article class="admin-balance-page-card">
          <span>Client</span>
          <strong>{{ client?.username || `#${clientId}` }}</strong>
          <small>Discord ID: {{ client?.discord_id || '—' }}</small>
        </article>
        <article class="admin-balance-page-card">
          <span>Balance</span>
          <strong :class="moneyTone(balance?.balance_amount)">
            {{ formatMoney(balance?.balance_amount) }}
          </strong>
          <small>Current client balance</small>
        </article>
      </div>

      <section class="admin-balance-page-section">
        <div class="admin-balance-page-head">
          <h2>Adjustment Form</h2>
        </div>
        <form
          class="admin-balance-page-form"
          @submit.prevent="submitAdjustment"
        >
          <UFormField
            label="Amount"
            class="admin-balance-page-field"
          >
            <UInput
              v-model="adjustmentForm.amount"
              placeholder="+50 or -25"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Note"
            class="admin-balance-page-field"
          >
            <UInput
              v-model="adjustmentForm.reason"
              placeholder="Reason"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Session"
            class="admin-balance-page-field admin-balance-page-field--session"
          >
            <USelect
              v-model="adjustmentSessionSnapshot"
              :items="adjustmentSessionItems"
              placeholder="Select recent session"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Password"
            class="admin-balance-page-field"
          >
            <UInput
              v-model="adjustmentForm.password"
              type="password"
              autocomplete="current-password"
              placeholder="Required"
              class="w-full"
            />
          </UFormField>
          <div class="admin-balance-page-item-picker">
            <ItemPicker
              v-model="adjustmentItemName"
              :required="false"
              @select="selectAdjustmentItem"
            />
            <UButton
              v-if="adjustmentForm.item_name"
              type="button"
              label="Clear item"
              color="neutral"
              variant="ghost"
              size="xs"
              class="admin-balance-page-clear-item"
              @click="clearAdjustmentItem"
            />
          </div>
          <UButton
            type="submit"
            label="Adjust"
            icon="i-lucide-circle-dollar-sign"
            class="admin-balance-page-submit"
            :loading="savingAdjustment"
            :disabled="!adjustmentForm.amount.trim() || !adjustmentForm.reason.trim() || !adjustmentForm.password.trim()"
          />
        </form>
      </section>

      <section class="admin-balance-page-section">
        <div class="admin-balance-page-head">
          <h2>Incoming Balance</h2>
          <span>Pending {{ formatMoney(pendingIncoming) }}</span>
        </div>
        <form
          class="admin-balance-page-form admin-balance-page-form--incoming"
          @submit.prevent="submitIncoming"
        >
          <UFormField
            label="Amount"
            class="admin-balance-page-field"
          >
            <UInput
              v-model.number="incomingForm.amount"
              type="number"
              min="0"
              step="0.01"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Note"
            class="admin-balance-page-field admin-balance-page-field--note"
          >
            <UInput
              v-model="incomingForm.note"
              placeholder="CheesePayout week"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Password"
            class="admin-balance-page-field"
          >
            <UInput
              v-model="incomingForm.password"
              type="password"
              autocomplete="current-password"
              placeholder="Required"
              class="w-full"
            />
          </UFormField>
          <UButton
            type="submit"
            label="Add Incoming"
            icon="i-lucide-plus"
            class="admin-balance-page-submit"
            :loading="savingIncoming"
            :disabled="!incomingForm.amount || incomingForm.amount <= 0 || !incomingForm.password?.trim()"
          />
        </form>

        <div
          v-if="!incoming.length"
          class="wallet-empty"
        >
          No incoming balance yet.
        </div>
        <div
          v-else
          class="wallet-table wallet-incoming-table"
        >
          <div class="wallet-table-row wallet-table-head admin-balance-incoming-row">
            <span>Amount</span>
            <span>Status</span>
            <span>Note</span>
            <span>Created By</span>
            <span>Created</span>
            <span>Actions</span>
          </div>
          <div
            v-for="row in incoming"
            :key="row.id"
            class="wallet-table-row admin-balance-incoming-row"
          >
            <strong class="admin-money-amount admin-money-amount--credit">{{ formatMoney(row.amount) }}</strong>
            <UBadge
              :color="incomingStatusColor(row.status)"
              variant="soft"
            >
              {{ row.status }}
            </UBadge>
            <span>{{ row.note || '—' }}</span>
            <span>{{ row.created_by || '—' }}</span>
            <time>{{ formatDate(row.created_at) }}</time>
            <span class="admin-data-table-actions">
              <UTooltip text="Confirm incoming">
                <UButton
                  v-if="row.status === 'pending'"
                  size="xs"
                  color="success"
                  variant="soft"
                  icon="i-lucide-check"
                  aria-label="Confirm incoming"
                  class="admin-data-table-icon-button"
                  @click="settleIncoming(row, 'confirm')"
                />
              </UTooltip>
              <UTooltip text="Cancel incoming">
                <UButton
                  v-if="row.status === 'pending'"
                  size="xs"
                  color="error"
                  variant="soft"
                  icon="i-lucide-x"
                  aria-label="Cancel incoming"
                  class="admin-data-table-icon-button"
                  @click="settleIncoming(row, 'cancel')"
                />
              </UTooltip>
            </span>
          </div>
        </div>
        <AdminPagination
          :pagination="incomingPagination"
          :loading="loading"
          @change="loadIncoming"
        />
      </section>

      <section class="admin-balance-page-section">
        <div class="admin-balance-page-head">
          <h2>Balance History</h2>
        </div>
        <div
          v-if="!ledger.length"
          class="wallet-empty"
        >
          No balance history yet.
        </div>
        <div
          v-else
          class="wallet-table wallet-ledger-table"
        >
          <div class="wallet-table-row wallet-table-head admin-balance-ledger-row">
            <span>Amount</span>
            <span>Type</span>
            <span>Item</span>
            <span>Session</span>
            <span>Note</span>
            <span>Updated By</span>
            <span>After</span>
            <span>Created</span>
          </div>
          <div
            v-for="entry in ledger"
            :key="entry.id"
            class="wallet-table-row admin-balance-ledger-row"
          >
            <strong :class="moneyTone(entry.amount)">{{ formatMoney(entry.amount) }}</strong>
            <span>{{ ledgerSourceLabel(entry) }}</span>
            <span class="balance-history-item-cell">
              <template v-if="entry.item_name">
                <img
                  v-if="entry.item_icon_url"
                  :src="entry.item_icon_url"
                  :alt="`${entry.item_name} icon`"
                  loading="lazy"
                >
                <span
                  v-else
                  class="balance-history-item-fallback"
                >
                  {{ entry.item_name.charAt(0).toUpperCase() }}
                </span>
                <span class="balance-history-item-copy">
                  <strong :class="itemQualityClass(entry.item_quality)">
                    {{ entry.item_name }}
                  </strong>
                  <small v-if="ledgerItemMeta(entry)">
                    {{ ledgerItemMeta(entry) }}
                  </small>
                </span>
              </template>
              <span
                v-else
                class="admin-player-muted"
              >
                —
              </span>
            </span>
            <span>{{ entry.session_snapshot || '—' }}</span>
            <span>{{ entry.note || entry.source || '—' }}</span>
            <span>{{ entry.created_by || '—' }}</span>
            <strong>{{ formatMoney(entry.balance_after) }}</strong>
            <time>{{ formatDate(entry.created_at) }}</time>
          </div>
        </div>
        <AdminPagination
          :pagination="ledgerPagination"
          :loading="loading"
          @change="loadLedger"
        />
      </section>
    </section>

    <UModal
      v-model:open="incomingActionModalOpen"
      :title="pendingIncomingAction?.action === 'confirm' ? 'Confirm incoming' : 'Cancel incoming'"
      :description="pendingIncomingAction ? `${pendingIncomingAction.action === 'confirm' ? 'Confirm' : 'Cancel'} incoming ${formatMoney(pendingIncomingAction.row.amount)}?` : ''"
    >
      <template #footer>
        <div class="session-end-confirm-actions">
          <UButton
            color="neutral"
            variant="outline"
            label="Cancel"
            @click="incomingActionModalOpen = false"
          />
          <UButton
            :color="pendingIncomingAction?.action === 'confirm' ? 'success' : 'error'"
            :label="pendingIncomingAction?.action === 'confirm' ? 'Confirm incoming' : 'Cancel incoming'"
            :loading="loading"
            @click="confirmIncomingAction"
          />
        </div>
      </template>
    </UModal>
  </main>
</template>
