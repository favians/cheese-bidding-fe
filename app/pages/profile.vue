<script setup lang="ts">
import type { FormError, FormSubmitEvent, TableColumn } from '@nuxt/ui'
import type { ClientCharacter, SaveClientCharacterRequest } from '#shared/types/api'
import { wowClasses } from '~/data/wowClasses'

definePageMeta({ middleware: 'auth' })

const auth = useAuthStore()
const characterStore = useCharactersStore()
const catalog = useCatalogStore()
const toast = useToast()
const activeSection = ref<'identity' | 'password' | 'characters'>('identity')
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const editingID = ref<number | null>(null)
const deleteTarget = ref<ClientCharacter | null>(null)
const deleteModalOpen = ref(false)
const inactiveModalOpen = ref(false)

const characterState = reactive<SaveClientCharacterRequest>({
  character_name: '',
  server: 'Nightslayer',
  class: '',
  faction: '',
  main_spec: '',
  off_spec: ''
})

const initial = computed(() => auth.profile?.username.charAt(0).toUpperCase() || '?')
const { classes } = storeToRefs(catalog)
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
const selectedClass = computed(() => classDefinitions.value.find(item => item.name === characterState.class))
const specializationItems = computed(() => selectedClass.value?.specializations ?? [])
const offSpecItems = computed(() => ['', ...specializationItems.value.filter(spec => spec !== characterState.main_spec)])
const characterColumns: TableColumn<ClientCharacter>[] = [
  { accessorKey: 'character_name', header: 'Character' },
  { accessorKey: 'faction', header: 'Faction' },
  { accessorKey: 'main_spec', header: 'Specialization' },
  { accessorKey: 'server', header: 'Server' },
  { id: 'actions', header: '' }
]

watch(() => auth.profile?.is_active, (isActive) => {
  if (isActive === false) inactiveModalOpen.value = true
}, { immediate: true })

onMounted(async () => {
  void catalog.loadClasses('client')
  if (!characterStore.loaded && !characterStore.loading) {
    try {
      await characterStore.load()
    } catch {
      // Store exposes the safe API error in the panel.
    }
  }
})

watch(() => characterState.class, () => {
  if (!specializationItems.value.includes(characterState.main_spec)) {
    characterState.main_spec = ''
  }
  if (!specializationItems.value.includes(characterState.off_spec)) {
    characterState.off_spec = ''
  }
})

watch(() => characterState.main_spec, () => {
  if (characterState.off_spec === characterState.main_spec) {
    characterState.off_spec = ''
  }
})

watch(activeSection, async (section) => {
  if (section === 'characters' && !characterStore.loaded && !characterStore.loading) {
    try {
      await characterStore.load()
    } catch {
      // Store exposes the safe API error in the panel.
    }
  }
})

function validateCharacter(state: Partial<SaveClientCharacterRequest>): FormError[] {
  const errors: FormError[] = []
  const name = state.character_name?.trim() ?? ''
  if (name.length < 2 || name.length > 24) {
    errors.push({ name: 'character_name', message: 'Use 2 to 24 characters' })
  }
  if (!state.class) {
    errors.push({ name: 'class', message: 'Select a class' })
  }
  if (!state.faction) {
    errors.push({ name: 'faction', message: 'Select a faction' })
  }
  if (!state.main_spec) {
    errors.push({ name: 'main_spec', message: 'Select a main specialization' })
  }
  return errors
}

function resetCharacterForm() {
  editingID.value = null
  Object.assign(characterState, {
    character_name: '',
    server: 'Nightslayer',
    class: '',
    faction: '',
    main_spec: '',
    off_spec: ''
  })
}

function editCharacter(character: ClientCharacter) {
  editingID.value = character.id
  Object.assign(characterState, {
    character_name: character.character_name,
    server: 'Nightslayer',
    class: character.class,
    faction: character.faction,
    main_spec: character.main_spec,
    off_spec: character.off_spec
  })
}

function requestDelete(character: ClientCharacter) {
  deleteTarget.value = character
  deleteModalOpen.value = true
}

async function submitCharacter(event: FormSubmitEvent<SaveClientCharacterRequest>) {
  try {
    event.data.server = 'Nightslayer'
    if (editingID.value) {
      await characterStore.update(editingID.value, event.data)
      toast.add({ title: 'Character updated', color: 'success', icon: 'i-lucide-circle-check' })
    } else {
      await characterStore.create(event.data)
      toast.add({ title: 'Character added', color: 'success', icon: 'i-lucide-circle-check' })
    }
    resetCharacterForm()
  } catch {
    // Store exposes the safe API error in the panel.
  }
}

async function confirmDelete() {
  if (!deleteTarget.value) {
    return
  }
  try {
    await characterStore.remove(deleteTarget.value.id)
    if (editingID.value === deleteTarget.value.id) {
      resetCharacterForm()
    }
    toast.add({ title: 'Character deleted', color: 'success', icon: 'i-lucide-trash-2' })
    deleteModalOpen.value = false
    deleteTarget.value = null
  } catch {
    // Store exposes the safe API error in the panel.
  }
}

function classSlug(className: string) {
  return className.toLowerCase()
}

function classIcon(className: string) {
  return classDefinitions.value.find(item => item.name === className)?.icon ?? ''
}

async function submitPassword() {
  auth.error = ''
  if (!currentPassword.value) {
    auth.error = 'Current password is required'
    return
  }
  if (newPassword.value.length < 6) {
    auth.error = 'New password must contain at least 6 characters'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    auth.error = 'New password confirmation does not match'
    return
  }
  try {
    await auth.changePassword(currentPassword.value, newPassword.value)
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    toast.add({ title: 'Password updated', color: 'success', icon: 'i-lucide-circle-check' })
  } catch {
    // Store exposes safe error message.
  }
}

async function logout() {
  await auth.logout()
  await navigateTo('/')
}
</script>

<template>
  <main class="profile-shell">
    <header class="topbar">
      <div class="brand">
        <div class="brand-head">
          <span class="brand-logo">🧀 Cheese GDKP</span>
        </div>
        <h1>Hello {{ auth.profile?.username }}</h1>
        <p>Manage your profile</p>
      </div>

      <div class="profile-header-actions">
        <UButton
          label="Logout"
          icon="i-lucide-log-out"
          color="neutral"
          variant="outline"
          @click="logout"
        />
      </div>
    </header>

    <section class="profile-showcase">
      <article class="profile-hero-card">
        <div class="profile-mark">
          {{ initial }}
        </div>
        <div class="profile-copy">
          <span>Client account</span>
          <h2>{{ auth.profile?.username }}</h2>
          <p>Discord ID {{ auth.profile?.discord_id }}</p>
        </div>
      </article>

      <article class="profile-info-card">
        <span>Account Status</span>
        <strong>{{ auth.profile?.is_active ? 'Active' : 'Inactive' }}</strong>
        <small>{{ auth.profile?.is_active ? 'Identity verified through CheeseBidding V2' : 'Character and password changes are blocked until admin reactivates this account' }}</small>
      </article>
    </section>

    <section class="profile-management">
      <div class="profile-management-grid">
        <aside class="profile-sidebar">
          <div class="profile-avatar">
            {{ initial }}
          </div>
          <h2>{{ auth.profile?.username }}</h2>
          <p>{{ auth.profile?.discord_id }}</p>

          <nav class="profile-menu">
            <button
              class="profile-menu-item"
              :class="{ 'is-active': activeSection === 'identity' }"
              type="button"
              @click="activeSection = 'identity'"
            >
              Identity
            </button>
            <button
              class="profile-menu-item"
              :class="{ 'is-active': activeSection === 'password' }"
              type="button"
              @click="activeSection = 'password'"
            >
              Password
            </button>
            <button
              class="profile-menu-item"
              :class="{ 'is-active': activeSection === 'characters' }"
              type="button"
              @click="activeSection = 'characters'"
            >
              Character List
              <small>{{ characterStore.characters.length }}</small>
            </button>
            <button
              class="profile-menu-item"
              type="button"
              @click="navigateTo('/wallet')"
            >
              Balance
              <small>Wallet</small>
            </button>
          </nav>
        </aside>

        <section
          v-if="activeSection === 'identity'"
          class="profile-content-panel"
        >
          <div class="profile-section-heading">
            <span>Identity</span>
            <h2>Account Information</h2>
          </div>

          <div class="identity-grid">
            <article class="identity-field">
              <span>Username</span>
              <strong>{{ auth.profile?.username }}</strong>
            </article>
            <article class="identity-field">
              <span>Discord ID</span>
              <strong>{{ auth.profile?.discord_id }}</strong>
            </article>
            <article class="identity-field">
              <span>Status</span>
              <strong>{{ auth.profile?.is_active ? 'Active' : 'Inactive' }}</strong>
            </article>
          </div>
        </section>

        <section
          v-else-if="activeSection === 'password'"
          class="profile-content-panel"
        >
          <div class="profile-section-heading">
            <span>Password</span>
            <h2>Reset Password</h2>
          </div>

          <UCard class="profile-password-card">
            <form
              class="profile-password-form"
              @submit.prevent="submitPassword"
            >
              <UFormField
                label="Current Password"
                required
              >
                <UInput
                  v-model="currentPassword"
                  type="password"
                  autocomplete="current-password"
                  size="lg"
                />
              </UFormField>
              <UFormField
                label="New Password"
                required
              >
                <UInput
                  v-model="newPassword"
                  type="password"
                  autocomplete="new-password"
                  size="lg"
                />
              </UFormField>
              <UFormField
                label="Confirm New Password"
                required
              >
                <UInput
                  v-model="confirmPassword"
                  type="password"
                  autocomplete="new-password"
                  size="lg"
                />
              </UFormField>

              <UButton
                type="submit"
                label="Reset Password"
                icon="i-lucide-key-round"
                :loading="auth.loading"
                :disabled="!auth.profile?.is_active"
              />
            </form>
          </UCard>
        </section>

        <section
          v-else
          class="profile-content-panel character-panel"
        >
          <div class="profile-section-heading">
            <span>Characters</span>
            <h2>{{ editingID ? 'Edit Character' : 'Character List' }}</h2>
          </div>

          <UCard class="character-form-card">
            <UForm
              :state="characterState"
              :validate="validateCharacter"
              class="character-form"
              @submit="submitCharacter"
            >
              <UFormField
                name="character_name"
                label="Character Name"
                required
              >
                <UInput
                  v-model="characterState.character_name"
                  maxlength="24"
                  placeholder="Thrall"
                />
              </UFormField>

              <UFormField
                name="class"
                label="Class"
                required
              >
                <USelect
                  v-model="characterState.class"
                  :items="classItems"
                  :avatar="selectedClass ? { src: selectedClass.icon, alt: `${selectedClass.name} icon` } : undefined"
                  placeholder="Select class"
                />
              </UFormField>

              <UFormField
                name="faction"
                label="Faction"
                required
              >
                <USelect
                  v-model="characterState.faction"
                  :items="factionItems"
                  placeholder="Select faction"
                />
              </UFormField>

              <UFormField
                name="main_spec"
                label="Main Specialization"
                required
              >
                <USelect
                  v-model="characterState.main_spec"
                  :items="specializationItems"
                  :disabled="!characterState.class"
                  placeholder="Select specialization"
                />
              </UFormField>

              <UFormField
                name="off_spec"
                label="Off Specialization"
                hint="Optional"
              >
                <USelect
                  v-model="characterState.off_spec"
                  :items="offSpecItems"
                  :disabled="!characterState.main_spec"
                  placeholder="None"
                />
              </UFormField>

              <div class="character-form-actions">
                <UButton
                  type="submit"
                  :label="editingID ? 'Save Character' : 'Add Character'"
                  :icon="editingID ? 'i-lucide-save' : 'i-lucide-plus'"
                  :loading="characterStore.saving"
                  :disabled="!auth.profile?.is_active"
                />
                <UButton
                  v-if="editingID"
                  type="button"
                  label="Cancel"
                  color="neutral"
                  variant="outline"
                  @click="resetCharacterForm"
                />
              </div>
            </UForm>
          </UCard>

          <UCard class="character-table-card">
            <div class="character-table-heading">
              <h3>Your Characters</h3>
              <span>{{ characterStore.characters.length }} registered</span>
            </div>

            <UTable
              :data="characterStore.characters"
              :columns="characterColumns"
              :loading="characterStore.loading"
            >
              <template #character_name-cell="{ row }">
                <div class="character-identity">
                  <img
                    class="character-class-icon"
                    :src="classIcon(row.original.class)"
                    :alt="`${row.original.class} icon`"
                  >
                  <span
                    class="character-name"
                    :class="`character-class--${classSlug(row.original.class)}`"
                  >
                    {{ row.original.character_name }}
                  </span>
                </div>
              </template>

              <template #faction-cell="{ row }">
                <UBadge
                  :color="row.original.faction === 'Horde' ? 'error' : 'info'"
                  variant="subtle"
                >
                  {{ row.original.faction }}
                </UBadge>
              </template>

              <template #main_spec-cell="{ row }">
                <div class="character-spec">
                  <strong>{{ row.original.main_spec }}</strong>
                  <small>{{ row.original.off_spec || 'No off spec' }}</small>
                </div>
              </template>

              <template #actions-cell="{ row }">
                <div class="character-actions">
                  <UButton
                    icon="i-lucide-pencil"
                    color="neutral"
                    variant="ghost"
                    aria-label="Edit character"
                    @click="editCharacter(row.original)"
                  />
                  <UButton
                    icon="i-lucide-trash-2"
                    color="error"
                    variant="ghost"
                    aria-label="Delete character"
                    @click="requestDelete(row.original)"
                  />
                </div>
              </template>

              <template #empty>
                <div class="character-empty">
                  <UIcon
                    name="i-lucide-shield-plus"
                    class="size-8"
                  />
                  <strong>No characters yet</strong>
                  <span>Add your first Nightslayer character above.</span>
                </div>
              </template>
            </UTable>
          </UCard>
        </section>
      </div>
    </section>

    <UModal
      v-model:open="deleteModalOpen"
      title="Delete character"
      description="This removes the character from your active roster."
    >
      <template #body>
        <p class="character-delete-copy">
          Delete {{ deleteTarget?.character_name }} from {{ deleteTarget?.server }}?
        </p>
      </template>
      <template #footer>
        <UButton
          label="Cancel"
          color="neutral"
          variant="outline"
          @click="deleteModalOpen = false"
        />
        <UButton
          label="Delete Character"
          color="error"
          icon="i-lucide-trash-2"
          :loading="characterStore.saving"
          @click="confirmDelete"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="inactiveModalOpen"
      title="Account inactive"
      description="Profile changes are disabled until an admin reactivates your account."
    >
      <template #footer>
        <div class="session-end-confirm-actions">
          <UButton
            color="neutral"
            variant="outline"
            label="Close"
            @click="inactiveModalOpen = false"
          />
        </div>
      </template>
    </UModal>
  </main>
</template>
