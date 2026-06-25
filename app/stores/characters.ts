import type { ClientCharacter, SaveClientCharacterRequest } from '#shared/types/api'

export const useCharactersStore = defineStore('characters', () => {
  const characters = ref<ClientCharacter[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const error = ref('')
  const loaded = ref(false)

  async function load() {
    const { request } = useApi()
    loading.value = true
    error.value = ''
    try {
      characters.value = await request<ClientCharacter[]>('/api/v1/client/characters/')
      loaded.value = true
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Character list failed to load'
      throw cause
    } finally {
      loading.value = false
    }
  }

  async function create(payload: SaveClientCharacterRequest) {
    const { request } = useApi()
    saving.value = true
    error.value = ''
    try {
      const character = await request<ClientCharacter>('/api/v1/client/characters/', {
        method: 'POST',
        body: payload
      })
      characters.value = [...characters.value, character].sort((a, b) => a.character_name.localeCompare(b.character_name))
      return character
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Character could not be added'
      throw cause
    } finally {
      saving.value = false
    }
  }

  async function update(id: number, payload: SaveClientCharacterRequest) {
    const { request } = useApi()
    saving.value = true
    error.value = ''
    try {
      const character = await request<ClientCharacter>(`/api/v1/client/characters/${id}`, {
        method: 'PUT',
        body: payload
      })
      characters.value = characters.value
        .map(item => item.id === id ? character : item)
        .sort((a, b) => a.character_name.localeCompare(b.character_name))
      return character
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Character could not be updated'
      throw cause
    } finally {
      saving.value = false
    }
  }

  async function remove(id: number) {
    const { request } = useApi()
    saving.value = true
    error.value = ''
    try {
      await request<{ status: boolean }>(`/api/v1/client/characters/${id}`, {
        method: 'DELETE'
      })
      characters.value = characters.value.filter(character => character.id !== id)
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Character could not be deleted'
      throw cause
    } finally {
      saving.value = false
    }
  }

  return {
    characters,
    loading,
    saving,
    error,
    loaded,
    load,
    create,
    update,
    remove
  }
})
