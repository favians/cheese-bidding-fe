import type {
  Balance,
  LedgerEntry,
  IncomingBalance,
  Withdrawal,
  CreateIncomingRequest,
  WithdrawalStatus,
  SettingResponse,
  Pagination,
  IncomingStatus
} from '#shared/types/api'

const KEY_MAINTENANCE = 'withdrawals_maintenance'
const KEY_GOLD_RATE = 'withdrawals_gold_to_dollar_rate'

export const useAdminMoneyStore = defineStore('admin-money', () => {
  const balances = ref<Balance[]>([])
  const ledger = ref<LedgerEntry[]>([])
  const incoming = ref<IncomingBalance[]>([])
  const withdrawals = ref<Withdrawal[]>([])
  const balancePagination = ref<Pagination | null>(null)
  const ledgerPagination = ref<Pagination | null>(null)
  const incomingPagination = ref<Pagination | null>(null)
  const withdrawalPagination = ref<Pagination | null>(null)
  const maintenance = ref(true)
  const goldRate = ref('0')
  const loading = ref(false)
  const saving = ref(false)
  const error = ref('')

  async function load(params: {
    balancePage?: number
    ledgerPage?: number
    incomingPage?: number
    withdrawalPage?: number
    ledgerSource?: string
    ledgerType?: 'all' | 'credit' | 'debit'
    incomingStatus?: 'all' | IncomingStatus
    withdrawalStatus?: 'all' | WithdrawalStatus
  } = {}) {
    loading.value = true
    error.value = ''
    try {
      await Promise.all([
        loadLedger(params.ledgerPage ?? ledgerPagination.value?.page ?? 1, params.ledgerSource, params.ledgerType),
        loadIncoming(params.incomingPage ?? incomingPagination.value?.page ?? 1, params.incomingStatus),
        loadWithdrawals(params.withdrawalPage ?? withdrawalPagination.value?.page ?? 1, params.withdrawalStatus)
      ])
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Failed to load money'
      throw cause
    } finally {
      loading.value = false
    }
    await loadSettings()
  }

  async function loadSettings() {
    const { request } = useApi()
    try {
      const m = await request<SettingResponse>(`/api/v1/internal/settings/${KEY_MAINTENANCE}`)
      maintenance.value = m?.value === 'true'
    } catch {
      maintenance.value = true
    }
    try {
      const r = await request<SettingResponse>(`/api/v1/internal/settings/${KEY_GOLD_RATE}`)
      goldRate.value = r?.value ?? '0'
    } catch {
      goldRate.value = '0'
    }
  }

  async function loadBalances(page = 1) {
    const { requestPaged } = useApi()
    const { data, pagination } = await requestPaged<Balance[]>('/api/v1/internal/balances', {
      query: { page: String(page), limit: '10' }
    })
    balances.value = data ?? []
    balancePagination.value = pagination
  }

  async function loadLedger(page = 1, source = 'all', ledgerType: 'all' | 'credit' | 'debit' = 'all') {
    const { requestPaged } = useApi()
    const query: Record<string, string> = { page: String(page), limit: '10' }
    if (source && source !== 'all') query.source = source
    if (ledgerType !== 'all') query.type = ledgerType
    const { data, pagination } = await requestPaged<LedgerEntry[]>('/api/v1/internal/balance/ledger', { query })
    ledger.value = data ?? []
    ledgerPagination.value = pagination
  }

  async function loadIncoming(page = 1, status: 'all' | IncomingStatus = 'all') {
    const { requestPaged } = useApi()
    const query: Record<string, string> = { page: String(page), limit: '10' }
    if (status !== 'all') query.status = status
    const { data, pagination } = await requestPaged<IncomingBalance[]>('/api/v1/internal/incoming-balances', { query })
    incoming.value = data ?? []
    incomingPagination.value = pagination
  }

  async function loadWithdrawals(page = 1, status: 'all' | WithdrawalStatus = 'all') {
    const { requestPaged } = useApi()
    const query: Record<string, string> = { page: String(page), limit: '10' }
    if (status !== 'all') query.status = status
    const { data, pagination } = await requestPaged<Withdrawal[]>('/api/v1/internal/withdrawals', { query })
    withdrawals.value = data ?? []
    withdrawalPagination.value = pagination
  }

  async function createIncoming(payload: CreateIncomingRequest) {
    const { request } = useApi()
    saving.value = true
    error.value = ''
    try {
      const row = await request<IncomingBalance>('/api/v1/internal/incoming-balances', { method: 'POST', body: payload })
      patchOrPrepend(incoming, row)
      await loadMoneyTables()
      return row
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Could not queue payout'
      throw cause
    } finally {
      saving.value = false
    }
  }

  async function settleIncoming(id: string, action: 'confirm' | 'cancel') {
    const { request } = useApi()
    error.value = ''
    try {
      const row = await request<IncomingBalance>(`/api/v1/internal/incoming-balances/${id}/${action}`, { method: 'POST' })
      patch(incoming, row)
      await loadMoneyTables()
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : `Could not ${action} payout`
      throw cause
    }
  }

  async function updateWithdrawal(id: string, status: WithdrawalStatus, adminNote: string) {
    const { request } = useApi()
    error.value = ''
    try {
      const row = await request<Withdrawal>(`/api/v1/internal/withdrawals/${id}/status`, {
        method: 'PUT',
        body: { status, admin_note: adminNote }
      })
      patch(withdrawals, row)
      await loadMoneyTables()
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Could not update withdrawal'
      throw cause
    }
  }

  async function setSetting(key: string, value: string) {
    const { request } = useApi()
    error.value = ''
    await request<SettingResponse>(`/api/v1/internal/settings/${key}`, { method: 'PUT', body: { value } })
  }

  async function setMaintenance(on: boolean) {
    await setSetting(KEY_MAINTENANCE, on ? 'true' : 'false')
    maintenance.value = on
  }

  async function setGoldRate(value: string) {
    await setSetting(KEY_GOLD_RATE, value)
    goldRate.value = value
  }

  async function loadMoneyTables() {
    await Promise.all([
      loadBalances(balancePagination.value?.page ?? 1),
      loadLedger(ledgerPagination.value?.page ?? 1),
      loadIncoming(incomingPagination.value?.page ?? 1),
      loadWithdrawals(withdrawalPagination.value?.page ?? 1)
    ])
  }

  function patch<T extends { id: string }>(list: Ref<T[]>, row: T) {
    const i = list.value.findIndex(x => x.id === row.id)
    if (i >= 0) list.value[i] = row
  }

  function patchOrPrepend<T extends { id: string }>(list: Ref<T[]>, row: T) {
    const i = list.value.findIndex(x => x.id === row.id)
    if (i >= 0) list.value[i] = row
    else list.value = [row, ...list.value]
  }

  return {
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
    error,
    load,
    loadBalances,
    loadLedger,
    loadIncoming,
    loadWithdrawals,
    createIncoming,
    settleIncoming,
    updateWithdrawal,
    setMaintenance,
    setGoldRate
  }
})
