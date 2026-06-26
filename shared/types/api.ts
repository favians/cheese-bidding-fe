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

export type AuctionStatus = 'active' | 'closed' | 'cancelled'
export type PrebidStatus = 'open' | 'resolved' | 'cancelled'

export interface Auction {
  id: string
  session_id: string
  item_name: string
  item_id: number
  item_instance_slug: string
  initial_buyer_name: string
  initial_price: number
  status: AuctionStatus
  min_bid: number
  bid_increment: number
  timer_seconds: number
  started_at: string
  ends_at: string
  closed_at: string | null
  current_bid: number
  current_winner_member_id: string
  winner_member_id: string
  winning_bid: number
  bid_count: number
  next_min_bid: number
}

export interface Prebid {
  id: string
  session_id: string
  item_name: string
  item_id: number
  item_instance_slug: string
  status: PrebidStatus
  min_bid: number
  bid_increment: number
  resolved_at: string | null
  auction_id: string
  current_bid: number
  current_winner_member_id: string
  bid_count: number
  initial_buyer_name: string
  initial_price: number
  quantity: number
  created_at: string
  next_min_bid: number
}
