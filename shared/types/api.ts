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
  bid_currency: BidCurrency
  management_cut_percent: number
  player_count: number
  date_to: string
  created_at: string
}

export interface CreateSessionRequest {
  title: string
  default_min_bid?: number
  default_bid_increment?: number
  default_timer_seconds?: number
  bid_currency?: BidCurrency
  management_cut_percent?: number
  player_count?: number
  date_to?: string
  instance_ids?: number[]
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
export type PrebidStatus = 'open' | 'resolved' | 'cancelled' | 'not_dropped'

export interface Auction {
  id: string
  session_id: string
  item_name: string
  item_id: number
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
  spawned_auction?: Auction | null
}

export interface CreateAuctionRequest {
  item_name: string
  item_id?: number
  initial_buyer_name?: string
  initial_price?: number
  min_bid?: number
  bid_increment?: number
  timer_seconds?: number
}

export interface CreatePrebidRequest {
  item_name: string
  item_id?: number
  initial_buyer_name?: string
  initial_price?: number
  quantity?: number
  min_bid?: number
  bid_increment?: number
}

export interface Instance {
  id: number
  name: string
  expansion: string
}

export type SessionInstance = Instance

export interface Item {
  id: number
  wow_item_id: number
  instance_id: number
  instance_name: string
  name: string
  quality: string
  boss_name: string
  icon_path: string
}

// --- money (amounts are decimal strings from the backend) ---

export interface Balance {
  client_id: number
  balance_amount: string
}

export interface BalanceAdjustmentRequest {
  amount: string
  reason: string
}

export interface LedgerEntry {
  id: string
  client_id: number
  source: string
  type: string
  amount: string
  balance_after: string
  note: string
  session_snapshot: string
  created_at: string
}

export type IncomingStatus = 'pending' | 'confirmed' | 'cancelled'
export type WithdrawalStatus = 'pending' | 'approved' | 'rejected' | 'paid'

export interface IncomingBalance {
  id: string
  client_id: number
  week_id: string
  amount: string
  status: IncomingStatus
  note: string
  created_at: string
  confirmed_at: string | null
  cancelled_at: string | null
}

export interface Withdrawal {
  id: string
  client_id: number
  amount: string
  payment_method: string
  original_amount: string
  original_currency: string
  conversion_rate: string
  status: WithdrawalStatus
  note: string
  admin_note: string
  created_at: string
  paid_at: string | null
}

export interface WithdrawalConfig {
  maintenance_mode: boolean
  gold_to_dollar_rate: string
}

export interface CreateWithdrawalRequest {
  amount: number
  payment_method: string
  note?: string
}

export interface CreateIncomingRequest {
  client_id: number
  week_id?: string
  amount: number
  note?: string
}

export interface UpdateWithdrawalStatusRequest {
  status: WithdrawalStatus
  admin_note?: string
}

export interface SettingResponse {
  key: string
  value: string
}

export interface ClientAdmin {
  id: number
  username: string
  discord_id: string
  is_active: boolean
  is_favorite: boolean
  created_at: string
}

export interface AdminCreateClientRequest {
  username: string
  password: string
  discord_id: string
}
