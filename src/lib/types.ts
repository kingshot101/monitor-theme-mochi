/** monitor hub 公开数据契约 —— 字段以 hub src/api.rs 为准（与 monitor-theme-default 一致） */

export type Metrics = {
  uptime: number
  cpu: number
  load: [number, number, number]
  mem_total: number
  mem_used: number
  swap_total: number
  swap_used: number
  disk_total: number
  disk_used: number
  net_rx: number
  net_tx: number
  total_rx: number
  total_tx: number
  month_rx: number
  month_tx: number
  tcp: number
  udp: number
  procs: number
}

export type Node = {
  id: number
  name: string
  sort: number
  public: boolean
  online: boolean
  /** ISO 3166-1 alpha-2，小写；可能为空 */
  country: string
  /** 分组名；缺失/空串 = 未分组 */
  group?: string
  last_seen: number
  /** 离线或数据未就绪时为 null */
  metrics: Metrics | null
  os: string
  kernel: string
  arch: string
  virt: string
  cpu_name: string
  cpu_cores: number
  mem_total: number
  swap_total: number
  disk_total: number
  agent_version: string
  price: number
  currency: string
  billing_cycle: string
  expires_at: string | null
  /** hub 按日历日算好的剩余天数；0=今天到期，负数=已过期，null/缺失=未设置 */
  expires_in?: number | null
  traffic_limit: number
  traffic_mode: string
  traffic_reset_day: number
  total_rx: number
  total_tx: number
  month_rx: number
  month_tx: number
  /** 本期已用流量（按 traffic_mode 口径），可能缺失 */
  month_used?: number
  month_start: string
  day_rx: number
  day_tx: number
}

export type Me = {
  authed: boolean
  github: boolean
  site_name: string
  public_page: boolean
}

/** metrics 历史 */
export type Point = {
  ts: number
  cpu: number
  mem_used: number
  disk_used: number
  net_rx: number
  net_tx: number
}

/** ping 历史：latency 为空表示该周期全部超时 */
export type PingPoint = {
  task_id: string
  ts: number
  latency: number | null
  band?: [number, number]
  loss?: number
}

export type Probes = Record<string, string>
export type LossMap = Record<string, number>

export type History = {
  metrics: Point[]
  ping: PingPoint[]
  probes: Probes
  loss?: LossMap
}

/** 主题站点设置：只包含被改过的键 */
export type ThemeConfig = Record<string, unknown>

export type RangeKey = "1h" | "6h" | "24h" | "7d"

export const RANGE_HOURS: Record<RangeKey, number> = { "1h": 1, "6h": 6, "24h": 24, "7d": 168 }
