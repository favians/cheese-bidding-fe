import type {
  Balance,
  LedgerEntry,
  Withdrawal,
  WithdrawalConfig,
  CreateWithdrawalRequest
} from '#shared/types/api'

export const useWalletStore = defineStore('wallet', () => {
  const balance = ref('0')
  const ledger = ref<LedgerEntry[]>([])
  const withdrawals = ref<Withdrawal[]>([])
  const config = ref<WithdrawalConfig | null>(null)
  const loading = ref(false)
  const submitting = ref(false)
  const error = ref('')

  async function load() {
    const { request } = useApi()
    loading.value = true
    error.value = ''
    try {
      const [b, l, w] = await Promise.all([
        request<Balance>('/api/v1/client/balance'),
        request<LedgerEntry[]>('/api/v1/client/balance/ledger'),
        request<Withdrawal[]>('/api/v1/client/withdrawals')
      ])
      balance.value = b?.balance_amount ?? '0'
      ledger.value = l ?? []
      withdrawals.value = w ?? []
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

  async function requestWithdrawal(payload: CreateWithdrawalRequest) {
    const { request } = useApi()
    submitting.value = true
    error.value = ''
    try {
      const wd = await request<Withdrawal>('/api/v1/client/withdrawals', {
        method: 'POST',
        body: payload
      })
      withdrawals.value = [wd, ...withdrawals.value]
      await load() // funds are held immediately — refresh balance + ledger
      return wd
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Withdrawal failed'
      throw cause
    } finally {
      submitting.value = false
    }
  }

  return { balance, ledger, withdrawals, config, loading, submitting, error, load, requestWithdrawal }
})
