<script setup lang="ts">
import type { AdminCreateClientRequest, ClientCharacter, SaveClientCharacterRequest } from '#shared/types/api'
import { wowClasses } from '~/data/wowClasses'

definePageMeta({ middleware: 'admin' })

const store = useAdminClientsStore()
const {
  clients,
  charactersByClient,
  balancesByClient,
  ledgerByClient,
  incomingByClient,
  withdrawalsByClient,
  pagination,
  loading,
  saving,
  error,
  lastPassword
} = storeToRefs(store)

const search = ref('')
const status = ref<'all' | 'active' | 'inactive'>('all')
const showCreate = ref(false)
const form = reactive<AdminCreateClientRequest>({ username: '', password: '', discord_id: '' })
const expandedClientId = ref<number | null>(null)
const balanceClientId = ref<number | null>(null)
const editingCharacterId = ref<number | null>(null)
const characterForm = reactive<SaveClientCharacterRequest>({
  character_name: '',
  server: 'Whitemane',
  class: '',
  faction: '',
  main_spec: '',
  off_spec: ''
})
let timer: ReturnType<typeof setTimeout> | undefined

const statusItems = ['all', 'active', 'inactive']
const classItems = wowClasses.map(item => item.name)
const factionItems = ['Horde', 'Alliance']
const selectedClass = computed(() => wowClasses.find(item => item.name === characterForm.class))
const specializationItems = computed(() => selectedClass.value?.specializations ?? [])

function loadPlayers(page = pagination.value?.page ?? 1) {
  return store.load({ search: search.value, status: status.value, page })
}

onMounted(() => loadPlayers(1))

watch(search, () => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => loadPlayers(1), 250)
})

watch(status, () => {
  void loadPlayers(1)
})

async function submitCreate() {
  if (!form.username.trim() || !form.password.trim() || !form.discord_id.trim()) return
  try {
    await store.create({ ...form })
    await loadPlayers(1)
    form.username = ''
    form.password = ''
    form.discord_id = ''
    showCreate.value = false
  } catch {
    // store exposes error
  }
}

async function editDiscord(id: number, current: string) {
  const next = window.prompt('Discord ID', current)
  if (next && next.trim() && next.trim() !== current) {
    await store.updateDiscord(id, next.trim())
  }
}

async function copyPassword() {
  if (lastPassword.value) {
    await navigator.clipboard.writeText(`${lastPassword.value.username} / ${lastPassword.value.password}`)
  }
}

function dismissPassword() {
  lastPassword.value = null
}

function totalPlayersText() {
  if (!pagination.value) return `${clients.value.length} players`
  return `${clients.value.length}/${pagination.value.data_total} players`
}

function characterRows(clientId: number) {
  return charactersByClient.value[clientId] ?? []
}

function ledgerRows(clientId: number) {
  return ledgerByClient.value[clientId] ?? []
}

function incomingRows(clientId: number) {
  return incomingByClient.value[clientId] ?? []
}

function withdrawalRows(clientId: number) {
  return withdrawalsByClient.value[clientId] ?? []
}

function balanceAmount(clientId: number) {
  return balancesByClient.value[clientId]?.balance_amount ?? '0'
}

async function toggleCharacters(clientId: number) {
  expandedClientId.value = expandedClientId.value === clientId ? null : clientId
  editingCharacterId.value = null
  resetCharacterForm()
  if (expandedClientId.value && !charactersByClient.value[clientId]) {
    await store.loadCharacters(clientId)
  }
}

async function toggleBalance(clientId: number) {
  balanceClientId.value = balanceClientId.value === clientId ? null : clientId
  if (balanceClientId.value && !balancesByClient.value[clientId]) {
    await store.loadBalanceDetail(clientId)
  }
}

function resetCharacterForm() {
  characterForm.character_name = ''
  characterForm.server = 'Whitemane'
  characterForm.class = ''
  characterForm.faction = ''
  characterForm.main_spec = ''
  characterForm.off_spec = ''
}

function editCharacter(character: ClientCharacter) {
  editingCharacterId.value = character.id
  characterForm.character_name = character.character_name
  characterForm.server = character.server
  characterForm.class = character.class
  characterForm.faction = character.faction
  characterForm.main_spec = character.main_spec
  characterForm.off_spec = character.off_spec
}

async function saveCharacter(clientId: number) {
  if (!characterForm.character_name.trim() || !characterForm.class || !characterForm.faction || !characterForm.main_spec) return
  const payload = { ...characterForm, character_name: characterForm.character_name.trim(), server: characterForm.server.trim() || 'Whitemane' }
  if (editingCharacterId.value) {
    await store.updateCharacter(clientId, editingCharacterId.value, payload)
  } else {
    await store.createCharacter(clientId, payload)
  }
  editingCharacterId.value = null
  resetCharacterForm()
}

async function removeCharacter(clientId: number, character: ClientCharacter) {
  if (!window.confirm(`Delete ${character.character_name}?`)) return
  await store.deleteCharacter(clientId, character.id)
}
</script>

<template>
  <main class="public-shell">
    <AdminNav
      title="Players"
      subtitle="Onboard & manage player accounts"
    >
      <template #actions>
        <UButton
          color="primary"
          icon="i-lucide-user-plus"
          label="New player"
          @click="showCreate = !showCreate"
        />
      </template>
    </AdminNav>

    <UAlert
      v-if="error"
      color="error"
      variant="soft"
      icon="i-lucide-circle-alert"
      :title="error"
      class="mb-4"
    />

    <!-- one-time password reveal -->
    <UAlert
      v-if="lastPassword"
      color="success"
      variant="soft"
      icon="i-lucide-key-round"
      class="mb-4"
      :title="`Password for ${lastPassword.username}`"
      :description="`${lastPassword.password} — copy and share it now; it won't be shown again.`"
      :actions="[
        { label: 'Copy', color: 'success', variant: 'soft', onClick: copyPassword },
        { label: 'Dismiss', color: 'neutral', variant: 'ghost', onClick: dismissPassword }
      ]"
    />

    <UCard
      v-if="showCreate"
      class="public-login-card mb-6"
    >
      <form
        class="login-form"
        @submit.prevent="submitCreate"
      >
        <div class="grid grid-cols-3 gap-3">
          <UFormField
            label="Username"
            required
          >
            <UInput
              v-model="form.username"
              class="w-full"
              autocomplete="off"
            />
          </UFormField>
          <UFormField
            label="Password"
            required
          >
            <UInput
              v-model="form.password"
              class="w-full"
              autocomplete="off"
            />
          </UFormField>
          <UFormField
            label="Discord ID"
            required
          >
            <UInput
              v-model="form.discord_id"
              class="w-full"
              placeholder="name#1234"
            />
          </UFormField>
        </div>
        <UButton
          type="submit"
          label="Create player"
          icon="i-lucide-check"
          block
          class="justify-center"
          :loading="saving"
        />
      </form>
    </UCard>

    <section class="user-list-toolbar mb-4">
      <UInput
        v-model="search"
        class="w-full"
        icon="i-lucide-search"
        placeholder="Search by username or discord…"
      />
      <USelect
        v-model="status"
        :items="statusItems"
        class="w-36"
      />
      <span class="text-sm opacity-70">{{ totalPlayersText() }}</span>
    </section>

    <div
      v-if="loading && !clients.length"
      class="py-8 text-center opacity-70"
    >
      Loading…
    </div>
    <div
      v-else-if="!clients.length"
      class="py-8 text-center opacity-70"
    >
      No players.
    </div>
    <div
      v-else
      class="grid gap-2"
    >
      <div
        v-for="c in clients"
        :key="c.id"
        class="admin-player-row"
      >
        <div class="admin-player-summary">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <strong>{{ c.username }}</strong>
              <span class="text-xs opacity-50">#{{ c.id }}</span>
              <UIcon
                v-if="c.is_favorite"
                name="i-lucide-star"
                class="h-4 w-4 text-(--color-cheese-400)"
              />
              <UBadge
                v-if="!c.is_active"
                color="neutral"
                variant="soft"
              >
                inactive
              </UBadge>
            </div>
            <div class="truncate text-xs opacity-60">
              {{ c.discord_id }}
              <span v-if="charactersByClient[c.id]">· {{ characterRows(c.id).length }} characters</span>
            </div>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <UButton
              size="xs"
              color="neutral"
              variant="soft"
              :icon="expandedClientId === c.id ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
              label="Characters"
              @click="toggleCharacters(c.id)"
            />
            <UButton
              size="xs"
              color="neutral"
              variant="soft"
              :icon="balanceClientId === c.id ? 'i-lucide-wallet-cards' : 'i-lucide-wallet'"
              label="Balance"
              @click="toggleBalance(c.id)"
            />
            <UButton
              size="xs"
              color="neutral"
              variant="soft"
              icon="i-lucide-pencil"
              label="Discord"
              @click="editDiscord(c.id, c.discord_id)"
            />
            <UButton
              size="xs"
              :color="c.is_favorite ? 'warning' : 'neutral'"
              variant="soft"
              :icon="c.is_favorite ? 'i-lucide-star-off' : 'i-lucide-star'"
              :label="c.is_favorite ? 'Unfav' : 'Fav'"
              @click="store.setFavorite(c.id, !c.is_favorite)"
            />
            <UButton
              size="xs"
              :color="c.is_active ? 'error' : 'success'"
              variant="soft"
              :label="c.is_active ? 'Deactivate' : 'Activate'"
              @click="store.setActive(c.id, !c.is_active)"
            />
            <UButton
              size="xs"
              color="primary"
              variant="soft"
              icon="i-lucide-key-round"
              label="Reset pw"
              @click="store.resetPassword(c.id)"
            />
          </div>
        </div>

        <div
          v-if="balanceClientId === c.id"
          class="admin-balance-panel"
        >
          <div class="admin-balance-summary">
            <span>
              Available balance
              <strong>{{ balanceAmount(c.id) }}</strong>
            </span>
            <UButton
              size="xs"
              color="neutral"
              variant="soft"
              icon="i-lucide-refresh-cw"
              label="Refresh"
              @click="store.loadBalanceDetail(c.id)"
            />
          </div>

          <div class="admin-balance-grid">
            <section>
              <h3>Ledger</h3>
              <div
                v-if="!ledgerRows(c.id).length"
                class="admin-character-empty"
              >
                No ledger entries.
              </div>
              <div
                v-for="entry in ledgerRows(c.id)"
                :key="entry.id"
                class="admin-balance-row"
              >
                <span>
                  <strong>{{ entry.amount }}</strong>
                  <small>{{ entry.type }} · {{ entry.source }} · bal {{ entry.balance_after }}</small>
                </span>
                <small>{{ entry.note || entry.session_snapshot || '—' }}</small>
              </div>
            </section>

            <section>
              <h3>Incoming</h3>
              <div
                v-if="!incomingRows(c.id).length"
                class="admin-character-empty"
              >
                No incoming payouts.
              </div>
              <div
                v-for="row in incomingRows(c.id)"
                :key="row.id"
                class="admin-balance-row"
              >
                <span>
                  <strong>{{ row.amount }}</strong>
                  <small>{{ row.week_id || '—' }} · {{ row.status }}</small>
                </span>
              </div>
            </section>

            <section>
              <h3>Withdrawals</h3>
              <div
                v-if="!withdrawalRows(c.id).length"
                class="admin-character-empty"
              >
                No withdrawals.
              </div>
              <div
                v-for="row in withdrawalRows(c.id)"
                :key="row.id"
                class="admin-balance-row"
              >
                <span>
                  <strong>{{ row.amount }}</strong>
                  <small>{{ row.payment_method }} · {{ row.status }}</small>
                </span>
              </div>
            </section>
          </div>
        </div>

        <div
          v-if="expandedClientId === c.id"
          class="admin-character-panel"
        >
          <form
            class="admin-character-form"
            @submit.prevent="saveCharacter(c.id)"
          >
            <UInput
              v-model="characterForm.character_name"
              placeholder="Character"
            />
            <UInput
              v-model="characterForm.server"
              placeholder="Server"
            />
            <USelect
              v-model="characterForm.class"
              :items="classItems"
              placeholder="Class"
            />
            <USelect
              v-model="characterForm.faction"
              :items="factionItems"
              placeholder="Faction"
            />
            <USelect
              v-model="characterForm.main_spec"
              :items="specializationItems"
              :disabled="!characterForm.class"
              placeholder="Main spec"
            />
            <UInput
              v-model="characterForm.off_spec"
              placeholder="Off spec"
            />
            <div class="admin-character-actions">
              <UButton
                type="submit"
                size="xs"
                color="primary"
                icon="i-lucide-save"
                :label="editingCharacterId ? 'Save' : 'Add'"
                :loading="saving"
              />
              <UButton
                v-if="editingCharacterId"
                type="button"
                size="xs"
                color="neutral"
                variant="ghost"
                label="Cancel"
                @click="editingCharacterId = null; resetCharacterForm()"
              />
            </div>
          </form>

          <div
            v-if="!characterRows(c.id).length"
            class="admin-character-empty"
          >
            No characters yet.
          </div>
          <div
            v-else
            class="admin-character-list"
          >
            <div
              v-for="character in characterRows(c.id)"
              :key="character.id"
              class="admin-character-row"
            >
              <span>
                <strong>{{ character.character_name }}</strong>
                <small>{{ character.class }} · {{ character.main_spec }} · {{ character.faction }}</small>
              </span>
              <span class="admin-character-row-actions">
                <UButton
                  size="xs"
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-pencil"
                  label="Edit"
                  @click="editCharacter(character)"
                />
                <UButton
                  size="xs"
                  color="error"
                  variant="soft"
                  icon="i-lucide-trash-2"
                  label="Delete"
                  @click="removeCharacter(c.id, character)"
                />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="pagination && pagination.page_total > 1"
      class="mt-4 flex items-center justify-between"
    >
      <UButton
        color="neutral"
        variant="soft"
        icon="i-lucide-chevron-left"
        label="Prev"
        :disabled="!pagination.prev_page || loading"
        @click="loadPlayers(pagination.page - 1)"
      />
      <span class="text-sm opacity-70">
        Page {{ pagination.page }} / {{ pagination.page_total }}
      </span>
      <UButton
        color="neutral"
        variant="soft"
        trailing-icon="i-lucide-chevron-right"
        label="Next"
        :disabled="!pagination.next_page || loading"
        @click="loadPlayers(pagination.page + 1)"
      />
    </div>
  </main>
</template>
