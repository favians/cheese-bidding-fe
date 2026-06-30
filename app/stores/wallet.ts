import type {
  Balance,
  LedgerEntry,
  Withdrawal,
  WithdrawalConfig,
  CreateWithdrawalRequest,
  Pagination
} from '#shared/types/api'

export const useWalletStore = defineStore('wallet', () => {
  const balance = ref('0')
  const ledger = ref<LedgerEntry[]>([])
  const withdrawals = ref<Withdrawal[]>([])
  const ledgerPagination = ref<Pagination | null>(null)
  const withdrawalPagination = ref<Pagination | null>(null)
  const config = ref<WithdrawalConfig | null>(null)
  const loading = ref(false)
  const submitting = ref(false)
  const error = ref('')

  async function load() {
    const { request } = useApi()
    loading.value = true
    error.value = ''
    try {
      const [b] = await Promise.all([
        request<Balance>('/api/v1/client/balance'),
        loadLedger(1),
        loadWithdrawals(1)
      ])
      balance.value = b?.balance_amount ?? '0'
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Failed to load wallet'
      throw cause
    } finally {
      loading.value = false
    }
    // config drives the maintenance notice; never let it blank the wallet
    try {
      config.value = await request<WithdrawalConfig>('/api/v1/client/withdrawals/config')
    } catch {
      config.value = null
    }
  }

  async function loadLedger(page = 1) {
    const { requestPaged } = useApi()
    const { data, pagination } = await requestPaged<LedgerEntry[]>('/api/v1/client/balance/ledger', {
      query: { page: String(page), limit: '10' }
    })
    ledger.value = data ?? []
    ledgerPagination.value = pagination
  }

  async function loadWithdrawals(page = 1) {
    const { requestPaged } = useApi()
    const { data, pagination } = await requestPaged<Withdrawal[]>('/api/v1/client/withdrawals', {
      query: { page: String(page), limit: '10' }
    })
    withdrawals.value = data ?? []
    withdrawalPagination.value = pagination
  }

  async function requestWithdrawal(payload: CreateWithdrawalRequest) {
    const { request } = useApi()
    submitting.value = true
    error.value = ''
    try {
      const wd = await request<Withdrawal>('/api/v1/client/withdrawals', {
        method: 'POST',
        body: payload
      })
      await load() // funds are held immediately — refresh balance + ledger
      return wd
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Withdrawal failed'
      throw cause
    } finally {
      submitting.value = false
    }
  }

  return {
    balance,
    ledger,
    withdrawals,
    ledgerPagination,
    withdrawalPagination,
    config,
    loading,
    submitting,
    error,
    load,
    loadLedger,
    loadWithdrawals,
    requestWithdrawal
  }
})
