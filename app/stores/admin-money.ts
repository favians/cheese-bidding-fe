import type {
  Balance,
  LedgerEntry,
  IncomingBalance,
  Withdrawal,
  CreateIncomingRequest,
  WithdrawalStatus,
  SettingResponse
} from '#shared/types/api'

const KEY_MAINTENANCE = 'withdrawals_maintenance'
const KEY_GOLD_RATE = 'withdrawals_gold_to_dollar_rate'

export const useAdminMoneyStore = defineStore('admin-money', () => {
  const balances = ref<Balance[]>([])
  const ledger = ref<LedgerEntry[]>([])
  const incoming = ref<IncomingBalance[]>([])
  const withdrawals = ref<Withdrawal[]>([])
  const maintenance = ref(true)
  const goldRate = ref('0')
  const loading = ref(false)
  const saving = ref(false)
  const error = ref('')

  async function load() {
    const { request } = useApi()
    loading.value = true
    error.value = ''
    try {
      const [bal, led, inc, wd] = await Promise.all([
        request<Balance[]>('/api/v1/internal/balances?limit=100'),
        request<LedgerEntry[]>('/api/v1/internal/balance/ledger?limit=100'),
        request<IncomingBalance[]>('/api/v1/internal/incoming-balances'),
        request<Withdrawal[]>('/api/v1/internal/withdrawals')
      ])
      balances.value = bal ?? []
      ledger.value = led ?? []
      incoming.value = inc ?? []
      withdrawals.value = wd ?? []
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Failed to load money'
      throw cause
    } finally {
      loading.value = false
    }
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

  async function createIncoming(payload: CreateIncomingRequest) {
    const { request } = useApi()
    saving.value = true
    error.value = ''
    try {
      const row = await request<IncomingBalance>('/api/v1/internal/incoming-balances', { method: 'POST', body: payload })
      incoming.value = [row, ...incoming.value]
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
    const { request } = useApi()
    const [bal, led] = await Promise.all([
      request<Balance[]>('/api/v1/internal/balances?limit=100'),
      request<LedgerEntry[]>('/api/v1/internal/balance/ledger?limit=100')
    ])
    balances.value = bal ?? []
    ledger.value = led ?? []
  }

  function patch<T extends { id: string }>(list: Ref<T[]>, row: T) {
    const i = list.value.findIndex(x => x.id === row.id)
    if (i >= 0) list.value[i] = row
  }

  return {
    balances,
    ledger,
    incoming,
    withdrawals,
    maintenance,
    goldRate,
    loading,
    saving,
    error,
    load,
    createIncoming,
    settleIncoming,
    updateWithdrawal,
    setMaintenance,
    setGoldRate
  }
})
