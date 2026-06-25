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

export interface AdminProfile {
  id: number
  username: string
  role: string
  is_active: boolean
  created_at: string
}

export type SessionStatus = 'active' | 'ended'
export type BidCurrency = 'dollar' | 'gold'

export interface Session {
  id: string
  code: string
  title: string
  status: SessionStatus
  default_min_bid: number
  default_bid_increment: number
  default_timer_seconds: number
  instance_slugs: string
  bid_currency: BidCurrency
  management_cut_percent: number
  player_count: number
  date_to: string
  created_at: string
}

export interface CreateSessionRequest {
  title: string
  instance_slugs?: string
  default_min_bid?: number
  default_bid_increment?: number
  default_timer_seconds?: number
  bid_currency?: BidCurrency
  management_cut_percent?: number
  player_count?: number
  date_to?: string
}

export interface SessionMember {
  id: string
  session_id: string
  discord_id: string
  discord_name: string
  character_name: string
  class_name: string
  spec_name: string
  joined_at: string
}
