import { CYCLE_DAYS } from "@/lib/format"
import type { Node } from "@/lib/types"

/**
 * 剩余价值计算 —— 折算口径参照 komari-monitor/vps_price_calculator（V4）
 * 与 realnovicedev/vps_calculator_docker：
 *   日均成本 = 单价 / 周期天数
 *   剩余价值 = 日均成本 × max(剩余天数, 0)
 *   剩余比例 = 剩余天数 / 周期天数（未提供购买日时，周期起点取 到期日 − 周期天数）
 *   本地补录了购买日时按 (今天 − 购买日) / (到期日 − 购买日) 精确折算
 */

export type Override = {
  price?: number
  currency?: string
  billing_cycle?: string
  purchased_at?: string
  expires_at?: string
}

export type PriceSource = {
  price: number
  currency: string
  billing_cycle: string
  expires_at: string | null
  expires_in?: number | null
}

export type ValueResult = {
  /** 是否有可用价格（hub 或本地补录） */
  hasPrice: boolean
  /** 价格是否来自本地补录覆盖 */
  fromLocal: boolean
  price: number
  currency: string
  billing_cycle: string
  /** 一次性/买断：不按周期折算 */
  isOnce: boolean
  /** 剩余天数；null = 未设置到期 */
  remainingDays: number | null
  expired: boolean
  /** 到期时刻 */
  expiryAt: Date | null
  daily: number | null
  monthly: number | null
  yearly: number | null
  remainingValue: number | null
  usedValue: number | null
  /** 剩余比例 0-1；null = 无法折算 */
  ratio: number | null
}

/** 主题配置注入：节点未设置货币时的兜底（default_currency） */
let DEFAULT_CURRENCY = ""
export function setDefaultCurrency(c: string) {
  DEFAULT_CURRENCY = (c || "").toUpperCase()
}

export function mergePrice(node: Node, override?: Override | null): PriceSource {
  const o = override ?? {}
  return {
    price: o.price ?? (typeof node.price === "number" ? node.price : 0),
    currency: o.currency || node.currency || DEFAULT_CURRENCY,
    billing_cycle: o.billing_cycle || node.billing_cycle || "",
    expires_at: o.expires_at ?? node.expires_at ?? null,
    // 本地覆盖了到期时间 → hub 的 expires_in 不再适用（undefined 交给浏览器自算）
    expires_in: o.expires_at !== undefined ? undefined : node.expires_in,
  }
}

export function cycleDays(cycle: string): number | null {
  return CYCLE_DAYS[cycle] ?? null
}

export function isOnce(cycle: string): boolean {
  return cycle === "once"
}

export function parseTime(v: string | number | null | undefined): Date | null {
  if (v == null || v === "") return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}

/** 剩余天数（日历日口径，与 hub expires_in 一致）：今天到期=0，明天=1，昨天到期=-1
 *  优先级：hub 的 expires_in（key 存在即用，含 null；浏览器时钟可能不准）→ 其余（本地覆盖/旧版 hub）按 expires_at 浏览器补算 */
export function remainingDays(src: PriceSource, now = new Date()): number | null {
  if (src.expires_in !== undefined) return src.expires_in
  const d = parseTime(src.expires_at)
  if (d) return calDays(d, now)
  return null
}

function calDays(target: Date, now: Date): number {
  const dayMs = 86400000
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime()
  return Math.round((startOfTarget - startOfToday) / dayMs)
}

export function expiryAt(src: PriceSource, now = new Date()): Date | null {
  const d = parseTime(src.expires_at)
  if (d) return d
  if (src.expires_in != null) {
    const dayMs = 86400000
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    return new Date(startOfToday + (src.expires_in + 1) * dayMs - 1)
  }
  return null
}

export function computeValue(
  src: PriceSource,
  override?: Override | null,
  now = new Date(),
): ValueResult {
  const remaining = remainingDays(src, now)
  const once = isOnce(src.billing_cycle)
  const days = cycleDays(src.billing_cycle)
  const hasPrice = typeof src.price === "number" && src.price > 0 && !!src.billing_cycle
  const price = hasPrice ? src.price : 0

  const daily = hasPrice && days ? price / days : null
  // 与周期天数表自洽：月付的月均=原价、年付的月均=价格/12
  const monthly = hasPrice && days ? (price * 30) / days : null
  const yearly = hasPrice && days ? (price * 365) / days : null

  let remainingValue: number | null = null
  let usedValue: number | null = null
  let ratio: number | null = null

  if (hasPrice && once) {
    // 买断：价值保留至到期，到期归零
    remainingValue = remaining == null ? price : remaining >= 0 ? price : 0
    usedValue = remaining != null && remaining < 0 ? price : 0
    ratio = remaining == null ? null : remaining >= 0 ? 1 : 0
  } else if (hasPrice && daily != null && remaining != null) {
    remainingValue = Math.max(0, daily * Math.max(remaining, 0))
    usedValue = Math.max(0, price - remainingValue)

    const expiry = expiryAt(src, now)
    const purchased = parseTime(override?.purchased_at)
    if (expiry && purchased && purchased.getTime() < expiry.getTime() && now > purchased) {
      const total = expiry.getTime() - purchased.getTime()
      ratio = Math.min(1, Math.max(0, (expiry.getTime() - now.getTime()) / total))
    } else if (days) {
      ratio = Math.min(1, Math.max(0, remaining / days))
    }
  }

  return {
    hasPrice,
    fromLocal: !!(override && (override.price != null || override.billing_cycle)),
    price,
    currency: src.currency,
    billing_cycle: src.billing_cycle,
    isOnce: once,
    remainingDays: remaining,
    expired: remaining != null && remaining < 0,
    expiryAt: expiryAt(src, now),
    daily,
    monthly,
    yearly,
    remainingValue,
    usedValue,
    ratio,
  }
}

/** 本期已用流量（bytes）：优先 month_used，其次 rx+tx */
export function periodTraffic(node: Node): number | null {
  if (typeof node.month_used === "number" && node.month_used >= 0) return node.month_used
  const m = node.metrics
  const rx = node.month_rx ?? m?.month_rx
  const tx = node.month_tx ?? m?.month_tx
  if (rx == null && tx == null) return null
  return (rx || 0) + (tx || 0)
}

/** 成本分摊：每资源·月成本 */
export function allocation(
  v: ValueResult,
  node: Node,
): { cores: number | null; memGB: number | null; diskGB: number | null } {
  const m = monthly(v)
  const gb = (b: number | null | undefined) => (b ? b / 1024 ** 3 : null)
  return {
    cores: m != null && node.cpu_cores > 0 ? m / node.cpu_cores : null,
    memGB: m != null && node.mem_total ? m / gb(node.mem_total)! : null,
    diskGB: m != null && node.disk_total ? m / gb(node.disk_total)! : null,
  }
}

function monthly(v: ValueResult): number | null {
  return v.monthly
}

/** 剩余天数展示分级：ok（充裕）/ warn（临近）/ bad（≤7 天）/ expired */
export type Urgency = "none" | "ok" | "warn" | "bad" | "expired"

export function urgency(remaining: number | null): Urgency {
  if (remaining == null) return "none"
  if (remaining < 0) return "expired"
  if (remaining <= 7) return "bad"
  if (remaining <= 30) return "warn"
  return "ok"
}
