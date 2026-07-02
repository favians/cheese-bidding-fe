<script setup lang="ts">
import type { AdminUpdateClientRequest, ClientAdmin, ClientCharacter, SaveClientCharacterRequest } from '#shared/types/api'
import { wowClasses } from '~/data/wowClasses'

definePageMeta({ middleware: 'admin' })

const store = useAdminClientsStore()
const catalog = useCatalogStore()
const {
  clients,
  charactersByClient,
  summary,
  pagination,
  loading,
  error,
  lastPassword
} = storeToRefs(store)
const { classes } = storeToRefs(catalog)

const search = ref('')
const status = ref<'all' | 'active' | 'inactive'>('active')
const expandedClientId = ref<number | null>(null)
const editingCharacterId = ref<number | null>(null)
const editPlayerOpen = ref(false)
const editPlayerId = ref<number | null>(null)
const editPlayerForm = reactive<AdminUpdateClientRequest>({
  username: '',
  discord_id: ''
})
const deleteCharacterModalOpen = ref(false)
const deleteCharacterTarget = ref<{ clientId: number, character: ClientCharacter } | null>(null)
const characterForm = reactive<SaveClientCharacterRequest>({
  character_name: '',
  server: 'Nightslayer',
  class: '',
  faction: '',
  main_spec: '',
  off_spec: ''
})
let timer: ReturnType<typeof setTimeout> | undefined

const statusItems = ['all', 'active', 'inactive']
const classDefinitions = computed(() => classes.value.length ? classes.value : wowClasses)
const classItems = computed(() => classDefinitions.value.map(item => ({
  label: item.name,
  value: item.name,
  avatar: {
    src: item.icon,
    alt: `${item.name} icon`
  }
})))
const factionItems = [
  { label: '🔵 Alliance', value: 'Alliance' },
  { label: '🔴 Horde', value: 'Horde' }
]
const playerColumns = [
  { key: 'player', label: 'Player' },
  { key: 'discord_id', label: 'Discord' },
  { key: 'characters', label: 'Characters' },
  { key: 'balance', label: 'Balance' },
  { key: 'incoming_balance', label: 'Incoming' },
  { key: 'status', label: 'Status' },
  { key: 'money', label: 'Money' },
  { key: 'actions', label: 'Actions' }
]
const selectedClass = computed(() => classDefinitions.value.find(item => item.name === characterForm.class))
const specializationItems = computed(() => selectedClass.value?.specializations ?? [])
const activePlayerDetailKeys = computed(() => {
  const keys = new Set<number>()
  if (expandedClientId.value) keys.add(expandedClientId.value)
  return [...keys]
})
const hasPlayerFilter = computed(() => Boolean(search.value.trim()) || status.value !== 'active')

function playerRowKey(row: ClientAdmin) {
  return row.id
}

function loadPlayers(page = pagination.value?.page ?? 1) {
  return store.load({ search: search.value, status: status.value, page })
}

onMounted(() => {
  void catalog.loadClasses('internal')
  void loadPlayers(1)
})

watch(search, () => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => loadPlayers(1), 250)
})

watch(status, () => {
  void loadPlayers(1)
})

function openEditPlayer(client: ClientAdmin) {
  editPlayerId.value = client.id
  editPlayerForm.username = client.username
  editPlayerForm.discord_id = client.discord_id
  editPlayerOpen.value = true
}

function closeEditPlayer() {
  editPlayerOpen.value = false
  editPlayerId.value = null
  editPlayerForm.username = ''
  editPlayerForm.discord_id = ''
}

async function savePlayerProfile() {
  if (!editPlayerId.value) return
  const username = editPlayerForm.username.trim()
  const discordID = editPlayerForm.discord_id.trim()
  if (!username || !discordID) return
  try {
    await store.updateProfile(editPlayerId.value, {
      username,
      discord_id: discordID
    })
    closeEditPlayer()
  } catch {
    // store exposes error
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

function playerBalanceAmount(client: ClientAdmin) {
  return client.balance_amount ?? '0'
}

function incomingBalanceAmount(client: ClientAdmin) {
  return client.incoming_balance_amount ?? '0'
}

function formatMoney(value: string | number) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return String(value)
  const formatted = Math.abs(numeric).toLocaleString('en-US')
  return numeric < 0 ? `-$${formatted}` : `$${formatted}`
}

function moneyTone(value: string | number) {
  return Number(value) < 0 ? 'admin-money-amount admin-money-amount--debit' : 'admin-money-amount admin-money-amount--credit'
}

async function toggleCharacters(clientId: number) {
  expandedClientId.value = expandedClientId.value === clientId ? null : clientId
  editingCharacterId.value = null
  resetCharacterForm()
  if (expandedClientId.value && !charactersByClient.value[clientId]) {
    await store.loadCharacters(clientId)
  }
}

function resetCharacterForm() {
  characterForm.character_name = ''
  characterForm.server = 'Nightslayer'
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
  const payload = { ...characterForm, character_name: characterForm.character_name.trim(), server: 'Nightslayer' }
  if (editingCharacterId.value) {
    await store.updateCharacter(clientId, editingCharacterId.value, payload)
  } else {
    await store.createCharacter(clientId, payload)
  }
  editingCharacterId.value = null
  resetCharacterForm()
}

function removeCharacter(clientId: number, character: ClientCharacter) {
  deleteCharacterTarget.value = { clientId, character }
  deleteCharacterModalOpen.value = true
}

async function confirmRemoveCharacter() {
  const target = deleteCharacterTarget.value
  if (!target) return
  await store.deleteCharacter(target.clientId, target.character.id)
  deleteCharacterModalOpen.value = false
  deleteCharacterTarget.value = null
}

async function toggleActive(client: ClientAdmin) {
  await store.setActive(client.id, !client.is_active)
  await loadPlayers(pagination.value?.page ?? 1)
}

async function toggleFavorite(client: ClientAdmin) {
  await store.setFavorite(client.id, !client.is_favorite)
  await loadPlayers(pagination.value?.page ?? 1)
}
</script>

<template>
  <main class="public-shell">
    <AdminNav
      title="Players"
      subtitle="Onboard & manage player accounts"
    />

    <div
      v-if="loading && !clients.length"
      class="py-8 text-center opacity-70"
    >
      Loading…
    </div>
    <div
      v-else-if="!clients.length && !hasPlayerFilter"
      class="admin-data-table-empty"
    >
      <UIcon
        name="i-lucide-users-round"
        class="h-8 w-8"
      />
      <strong>No players yet.</strong>
      <span>Create the first player account, then attach characters from this page.</span>
      <UButton
        color="primary"
        icon="i-lucide-user-plus"
        label="New player"
        class="admin-data-table-primary-action"
        to="/admin/players/new"
      />
    </div>
    <template v-else>
      <section class="admin-player-summary-cards">
        <article class="admin-player-summary-card">
          <span>Total surplus balance</span>
          <strong class="admin-money-amount admin-money-amount--credit">
            {{ formatMoney(summary.total_surplus_balance_amount) }}
          </strong>
          <small>Positive balances</small>
        </article>
        <article class="admin-player-summary-card">
          <span>Total minus balance</span>
          <strong class="admin-money-amount admin-money-amount--debit">
            {{ formatMoney(summary.total_minus_balance_amount) }}
          </strong>
          <small>Negative balances</small>
        </article>
        <article class="admin-player-summary-card">
          <span>Total incoming balance</span>
          <strong class="admin-money-amount admin-money-amount--incoming">
            {{ formatMoney(summary.total_incoming_amount) }}
          </strong>
          <small>Pending incoming</small>
        </article>
      </section>

      <AdminDataTable
        :columns="playerColumns"
        :rows="clients"
        :row-key="playerRowKey"
        :detail-row-keys="activePlayerDetailKeys"
      >
        <template #header>
          <div class="admin-data-table-heading">
            <div>
              <strong>Player list</strong>
              <span>{{ totalPlayersText() }}</span>
            </div>
            <UButton
              color="primary"
              icon="i-lucide-user-plus"
              label="New player"
              class="admin-data-table-primary-action"
              to="/admin/players/new"
            />
          </div>
          <div class="admin-data-table-toolbar">
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
          </div>
        </template>

        <template
          v-if="!clients.length"
          #empty
        >
          <div class="admin-data-table-empty admin-data-table-empty--inline">
            <UIcon
              name="i-lucide-search-x"
              class="h-8 w-8"
            />
            <strong>No players found.</strong>
            <span>Try different search or status filter.</span>
          </div>
        </template>

        <template #cell-player="{ row: c }">
          <div class="session-list-title">
            <strong class="admin-player-name">
              <UIcon
                v-if="c.is_favorite"
                name="i-lucide-star"
                class="admin-player-favorite-icon"
              />
              {{ c.username }}
            </strong>
            <span>#{{ c.id }}</span>
          </div>
        </template>

        <template #cell-discord_id="{ row: c }">
          <span class="admin-player-mono">{{ c.discord_id }}</span>
        </template>

        <template #cell-characters="{ row: c }">
          <span v-if="charactersByClient[c.id]">{{ characterRows(c.id).length }} characters</span>
          <span
            v-else
            class="admin-player-muted"
          >
            Not loaded
          </span>
        </template>

        <template #cell-balance="{ row: c }">
          <span :class="moneyTone(playerBalanceAmount(c))">
            {{ formatMoney(playerBalanceAmount(c)) }}
          </span>
        </template>

        <template #cell-incoming_balance="{ row: c }">
          <span
            :class="Number(incomingBalanceAmount(c)) > 0
              ? 'admin-money-amount admin-money-amount--incoming'
              : 'admin-player-muted'"
          >
            {{ formatMoney(incomingBalanceAmount(c)) }}
          </span>
        </template>

        <template #cell-status="{ row: c }">
          <div class="admin-player-badges">
            <UBadge
              :color="c.is_active ? 'success' : 'neutral'"
              variant="soft"
            >
              {{ c.is_active ? 'active' : 'inactive' }}
            </UBadge>
          </div>
        </template>

        <template #cell-money="{ row: c }">
          <UTooltip text="Open money page">
            <UButton
              size="xs"
              color="primary"
              variant="soft"
              icon="i-lucide-wallet"
              label="Money"
              aria-label="Open money page"
              class="admin-data-table-money-button"
              :to="`/admin/players/${c.id}/balance`"
            />
          </UTooltip>
        </template>

        <template #cell-actions="{ row: c }">
          <div class="admin-data-table-actions">
            <UTooltip text="Characters">
              <UButton
                size="xs"
                color="neutral"
                variant="soft"
                :icon="expandedClientId === c.id ? 'i-lucide-chevron-up' : 'i-lucide-users-round'"
                aria-label="Characters"
                class="admin-data-table-icon-button"
                @click="toggleCharacters(c.id)"
              />
            </UTooltip>
            <UTooltip text="Edit player">
              <UButton
                size="xs"
                color="neutral"
                variant="soft"
                icon="i-lucide-pencil"
                aria-label="Edit player"
                class="admin-data-table-icon-button"
                @click="openEditPlayer(c)"
              />
            </UTooltip>
            <UTooltip :text="c.is_favorite ? 'Remove favorite' : 'Mark favorite'">
              <UButton
                size="xs"
                :color="c.is_favorite ? 'warning' : 'neutral'"
                variant="soft"
                :icon="c.is_favorite ? 'i-lucide-star-off' : 'i-lucide-star'"
                aria-label="Toggle favorite"
                class="admin-data-table-icon-button"
                @click="toggleFavorite(c)"
              />
            </UTooltip>
            <UTooltip :text="c.is_active ? 'Deactivate' : 'Activate'">
              <UButton
                size="xs"
                :color="c.is_active ? 'error' : 'success'"
                variant="soft"
                :icon="c.is_active ? 'i-lucide-user-x' : 'i-lucide-user-check'"
                aria-label="Toggle active"
                class="admin-data-table-icon-button"
                @click="toggleActive(c)"
              />
            </UTooltip>
            <UTooltip text="Reset password">
              <UButton
                size="xs"
                color="primary"
                variant="soft"
                icon="i-lucide-key-round"
                aria-label="Reset password"
                class="admin-data-table-icon-button"
                @click="store.resetPassword(c.id)"
              />
            </UTooltip>
          </div>
        </template>

        <template #detail="{ row: c }">
          <div
            v-if="expandedClientId === c.id"
            class="admin-data-table-detail"
          >
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
                <USelect
                  v-model="characterForm.class"
                  :items="classItems"
                  :avatar="selectedClass ? { src: selectedClass.icon, alt: `${selectedClass.name} icon` } : undefined"
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
                    :loading="store.saving"
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
        </template>
      </AdminDataTable>
    </template>

    <AdminPagination
      :pagination="pagination"
      :loading="loading"
      @change="loadPlayers"
    />

    <UModal
      v-model:open="editPlayerOpen"
      title="Edit player"
      description="Update username and Discord ID."
      class="admin-player-edit-modal"
    >
      <template #body>
        <form
          id="admin-edit-player-form"
          class="admin-player-edit-form"
          @submit.prevent="savePlayerProfile"
        >
          <UFormField
            label="Username"
            required
          >
            <UInput
              v-model="editPlayerForm.username"
              class="w-full"
              autocomplete="off"
              placeholder="Username"
            />
          </UFormField>
          <UFormField
            label="Discord ID"
            required
          >
            <UInput
              v-model="editPlayerForm.discord_id"
              class="w-full"
              autocomplete="off"
              placeholder="Discord ID"
            />
          </UFormField>
        </form>
      </template>
      <template #footer>
        <div class="admin-player-edit-actions">
          <UButton
            label="Cancel"
            color="neutral"
            variant="outline"
            @click="closeEditPlayer"
          />
          <UButton
            type="submit"
            form="admin-edit-player-form"
            label="Save player"
            color="primary"
            :loading="store.saving"
          />
        </div>
      </template>
    </UModal>

    <UModal
      :open="!!lastPassword"
      :title="lastPassword ? `Password for ${lastPassword.username}` : 'Password generated'"
      :description="lastPassword ? `${lastPassword.password} — copy and share it now; it will not be shown again.` : ''"
      @update:open="value => { if (!value) dismissPassword() }"
    >
      <template #footer>
        <div class="admin-player-edit-actions">
          <UButton
            label="Copy"
            color="success"
            variant="soft"
            icon="i-lucide-copy"
            @click="copyPassword"
          />
          <UButton
            label="Dismiss"
            color="neutral"
            variant="outline"
            @click="dismissPassword"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="deleteCharacterModalOpen"
      title="Delete character"
      :description="deleteCharacterTarget ? `Delete ${deleteCharacterTarget.character.character_name}?` : ''"
    >
      <template #footer>
        <div class="admin-player-edit-actions">
          <UButton
            label="Cancel"
            color="neutral"
            variant="outline"
            @click="deleteCharacterModalOpen = false"
          />
          <UButton
            label="Delete"
            color="error"
            :loading="store.saving"
            @click="confirmRemoveCharacter"
          />
        </div>
      </template>
    </UModal>
  </main>
</template>
