<script setup lang="ts">
import type { CreateIncomingRequest, WithdrawalStatus } from '#shared/types/api'

definePageMeta({ middleware: 'admin' })

const store = useAdminMoneyStore()
const { incoming, withdrawals, maintenance, goldRate, loading, saving, error } = storeToRefs(store)

const form = reactive<CreateIncomingRequest>({ client_id: 0, amount: 0, week_id: '', note: '' })
const rateDraft = ref('0')

onMounted(async () => {
  await store.load()
  rateDraft.value = goldRate.value
})

const statusColor: Record<WithdrawalStatus, 'warning' | 'info' | 'error' | 'success'> = {
  pending: 'warning',
  approved: 'info',
  rejected: 'error',
  paid: 'success'
}

// allowed next states from each withdrawal status
function nextStates(status: WithdrawalStatus): WithdrawalStatus[] {
  if (status === 'pending') return ['approved', 'rejected']
  if (status === 'approved') return ['paid', 'rejected']
  return []
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
  try {
    await store.updateWithdrawal(id, status, note)
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

    <!-- Incoming payouts -->
    <section class="mb-6">
      <h2 class="mb-2 text-lg font-semibold">
        Incoming payouts
      </h2>
      <div
        v-if="!incoming.length"
        class="py-4 text-center text-sm opacity-60"
      >
        None.
      </div>
      <div
        v-else
        class="grid gap-2"
      >
        <div
          v-for="row in incoming"
          :key="row.id"
          class="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm"
        >
          <span>
            client <strong>{{ row.client_id }}</strong> · <strong>{{ row.amount }}</strong>
            <span class="opacity-60">· {{ row.week_id || '—' }} · {{ row.status }}</span>
          </span>
          <div
            v-if="row.status === 'pending'"
            class="flex gap-2"
          >
            <UButton
              size="xs"
              color="success"
              variant="soft"
              label="Confirm"
              @click="store.settleIncoming(row.id, 'confirm')"
            />
            <UButton
              size="xs"
              color="error"
              variant="soft"
              label="Cancel"
              @click="store.settleIncoming(row.id, 'cancel')"
            />
          </div>
        </div>
      </div>
    </section>

    <!-- Withdrawals -->
    <section>
      <h2 class="mb-2 text-lg font-semibold">
        Withdrawals
      </h2>
      <div
        v-if="loading && !withdrawals.length"
        class="py-4 text-center text-sm opacity-60"
      >
        Loading…
      </div>
      <div
        v-else-if="!withdrawals.length"
        class="py-4 text-center text-sm opacity-60"
      >
        None.
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
            client <strong>{{ wd.client_id }}</strong> · <strong>{{ wd.amount }}</strong> · {{ wd.payment_method }}
            <UBadge
              :color="statusColor[wd.status]"
              variant="soft"
              class="ml-2"
            >
              {{ wd.status }}
            </UBadge>
          </span>
          <div class="flex gap-2">
            <UButton
              v-for="s in nextStates(wd.status)"
              :key="s"
              size="xs"
              :color="s === 'rejected' ? 'error' : s === 'paid' ? 'success' : 'primary'"
              variant="soft"
              :label="s"
              @click="moveWithdrawal(wd.id, s)"
            />
          </div>
        </div>
      </div>
    </section>
  </main>
</template>
