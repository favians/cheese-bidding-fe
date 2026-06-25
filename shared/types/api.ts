// Backend response envelope — shared by the Nitro server and the Vue app.
export interface ApiError {
  status: boolean
  msg: string
  code: number
}

export interface Pagination {
  page: number
  limit: number
  page_total: number
  data_total: number
  next_page: boolean
  prev_page: boolean
}

export interface ApiEnvelope<T> {
  data: T
  pagination?: Pagination | null
  error: ApiError
}

export interface ClientProfile {
  id: number
  username: string
  discord_id: string
  is_active: boolean
  is_favorite: boolean
}

export interface ClientCharacter {
  id: number
  client_id: number
  character_name: string
  server: string
  class: string
  class_color: string
  faction: 'Horde' | 'Alliance'
  main_spec: string
  off_spec: string
  created_at: string
}

export interface SaveClientCharacterRequest {
  character_name: string
  server: string
  class: string
  faction: 'Horde' | 'Alliance' | ''
  main_spec: string
  off_spec: string
}
