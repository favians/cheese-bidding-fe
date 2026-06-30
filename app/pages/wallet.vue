<script setup lang="ts">
import type { CreateWithdrawalRequest, WithdrawalStatus, LedgerEntry } from '#shared/types/api'

definePageMeta({ middleware: 'auth' })

const wallet = useWalletStore()
const { balance, ledger, withdrawals, ledgerPagination, withdrawalPagination, config, loading, submitting, error } = storeToRefs(wallet)

const form = reactive<CreateWithdrawalRequest>({ amount: 0, payment_method: '', note: '' })

onMounted(() => wallet.load())

const maintenance = computed(() => config.value?.maintenance_mode ?? false)

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
  return entry.type === 'credit' ? 'text-green-400' : 'text-red-400'
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

    <UAlert
      v-if="error"
      color="error"
      variant="soft"
      icon="i-lucide-circle-alert"
      :title="error"
      class="mb-4"
    />

    <UCard class="profile-hero-card mb-6">
      <div class="flex items-center justify-between gap-4">
        <div>
          <div class="text-sm opacity-70">
            Available balance
          </div>
          <div class="text-3xl font-bold">
            {{ balance }}
          </div>
        </div>
        <UIcon
          name="i-lucide-wallet"
          class="h-10 w-10 opacity-40"
        />
      </div>
    </UCard>

    <UAlert
      v-if="maintenance"
      color="warning"
      variant="soft"
      icon="i-lucide-wrench"
      title="Withdrawals are temporarily closed"
      description="The admin has withdrawals in maintenance. Try again later."
      class="mb-6"
    />

    <UCard
      v-else
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

    <section class="mb-6">
      <h2 class="mb-2 text-lg font-semibold">
        My withdrawals
      </h2>
      <div
        v-if="!withdrawals.length"
        class="py-4 text-center text-sm opacity-60"
      >
        No withdrawals yet.
      </div>
      <div
        v-else
        class="grid gap-2"
      >
        <div
          v-for="wd in withdrawals"
          :key="wd.id"
          class="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm"
        >
          <span>
            <strong>{{ wd.amount }}</strong> · {{ wd.payment_method }}
            <span
              v-if="wd.admin_note"
              class="opacity-60"
            >· {{ wd.admin_note }}</span>
          </span>
          <UBadge
            :color="statusColor[wd.status]"
            variant="soft"
          >
            {{ wd.status }}
          </UBadge>
        </div>
      </div>
      <AdminPagination
        :pagination="withdrawalPagination"
        :loading="loading"
        @change="wallet.loadWithdrawals"
      />
    </section>

    <section>
      <h2 class="mb-2 text-lg font-semibold">
        Ledger
      </h2>
      <div
        v-if="loading && !ledger.length"
        class="py-4 text-center text-sm opacity-60"
      >
        Loading…
      </div>
      <div
        v-else-if="!ledger.length"
        class="py-4 text-center text-sm opacity-60"
      >
        No transactions yet.
      </div>
      <div
        v-else
        class="grid gap-1"
      >
        <div
          v-for="entry in ledger"
          :key="entry.id"
          class="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm"
        >
          <span>
            <span :class="ledgerAmountClass(entry)">{{ entry.amount }}</span>
            <span class="ml-2 opacity-70">{{ ledgerSourceLabel(entry) }}</span>
            <span
              v-if="entry.note"
              class="ml-2 opacity-50"
            >· {{ entry.note }}</span>
          </span>
          <span class="opacity-50">bal {{ entry.balance_after }}</span>
        </div>
      </div>
      <AdminPagination
        :pagination="ledgerPagination"
        :loading="loading"
        @change="wallet.loadLedger"
      />
    </section>
  </main>
</template>
