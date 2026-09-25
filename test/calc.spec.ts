import { describe, expect, it } from "vitest"
import {
  computeValue,
  expiryAt,
  mergePrice,
  periodTraffic,
  remainingDays,
  urgency,
} from "@/value/calc"
import type { Node } from "@/lib/types"

const DAY = 86400000
const NOW = new Date("2026-09-24T12:00:00+08:00")

function node(over: Partial<Node>): Node {
  return {
    id: 1,
    name: "n",
    sort: 0,
    public: true,
    online: true,
    country: "hk",
    group: "",
    last_seen: 0,
    metrics: null,
    os: "debian",
    kernel: "",
    arch: "x86_64",
    virt: "kvm",
    cpu_name: "",
    cpu_cores: 2,
    mem_total: 2 * 1024 ** 3,
    swap_total: 0,
    disk_total: 40 * 1024 ** 3,
    agent_version: "",
    price: 0,
    currency: "",
    billing_cycle: "",
    expires_at: null,
    expires_in: null,
    traffic_limit: 0,
    traffic_mode: "sum",
    traffic_reset_day: 1,
    total_rx: 0,
    total_tx: 0,
    month_rx: 0,
    month_tx: 0,
    month_start: "",
    day_rx: 0,
    day_tx: 0,
    ...over,
  }
}

describe("remainingDays", () => {
  it("优先使用 hub 的 expires_in（key 存在即用，即使也有 expires_at）", () => {
    const src = mergePrice(node({ expires_in: 23, expires_at: new Date(NOW.getTime() + 30 * DAY).toISOString() }))
    expect(remainingDays(src, NOW)).toBe(23)
  })

  it("expires_in=null 表示未设置到期", () => {
    const src = mergePrice(node({ expires_in: null, expires_at: null }))
    expect(remainingDays(src, NOW)).toBeNull()
  })

  it("expires_in 为 0 表示今天到期", () => {
    const src = mergePrice(node({ expires_in: 0 }))
    expect(remainingDays(src, NOW)).toBe(0)
  })

  it("旧版 hub 没有 expires_in 时，用浏览器时钟按 expires_at 补算", () => {
    const src = mergePrice(node({ expires_in: undefined, expires_at: new Date(NOW.getTime() + 5 * DAY).toISOString() }))
    expect(remainingDays(src, NOW)).toBe(5)
    const past = mergePrice(node({ expires_in: undefined, expires_at: new Date(NOW.getTime() - 2 * DAY).toISOString() }))
    expect(remainingDays(past, NOW)).toBe(-2)
  })

  it("本地覆盖 expires_at 优先于 hub", () => {
    const n = node({ expires_in: 100 })
    const o = { expires_at: new Date(NOW.getTime() + 9 * DAY).toISOString() }
    const src = mergePrice(n, o)
    expect(remainingDays(src, NOW)).toBe(9)
  })
})

describe("computeValue 折算", () => {
  it("月付价格：日均=价格/30，剩余价值=日均×剩余天数", () => {
    const n = node({ price: 30, currency: "CNY", billing_cycle: "monthly", expires_in: 10 })
    const v = computeValue(mergePrice(n), null, NOW)
    expect(v.hasPrice).toBe(true)
    expect(v.daily).toBeCloseTo(1, 5)
    expect(v.remainingValue).toBeCloseTo(10, 5)
    expect(v.usedValue).toBeCloseTo(20, 5)
    expect(v.ratio).toBeCloseTo(10 / 30, 5)
    expect(v.expired).toBe(false)
  })

  it("年付价格：月均 = 价格×30/365（与周期天数表自洽）", () => {
    const n = node({ price: 365, currency: "USD", billing_cycle: "yearly", expires_in: 73 })
    const v = computeValue(mergePrice(n), null, NOW)
    expect(v.monthly).toBeCloseTo(365 * 30 / 365, 5) // = 30
    expect(v.remainingValue).toBeCloseTo(1 * 73, 5)
  })

  it("已过期：剩余价值为 0，已消耗=全价", () => {
    const n = node({ price: 100, currency: "CNY", billing_cycle: "monthly", expires_in: -3 })
    const v = computeValue(mergePrice(n), null, NOW)
    expect(v.expired).toBe(true)
    expect(v.remainingValue).toBe(0)
    expect(v.usedValue).toBeCloseTo(100, 5)
    expect(v.ratio).toBe(0)
  })

  it("买断 once：未到期剩余价值=全价，到期归零", () => {
    const ok = node({ price: 899, currency: "CNY", billing_cycle: "once", expires_in: 30 })
    expect(computeValue(mergePrice(ok), null, NOW).remainingValue).toBe(899)
    const dead = node({ price: 899, currency: "CNY", billing_cycle: "once", expires_in: -1 })
    expect(computeValue(mergePrice(dead), null, NOW).remainingValue).toBe(0)
  })

  it("未设置价格：hasPrice=false，数值全空", () => {
    const n = node({ price: 0, billing_cycle: "", expires_in: 12 })
    const v = computeValue(mergePrice(n), null, NOW)
    expect(v.hasPrice).toBe(false)
    expect(v.remainingValue).toBeNull()
    expect(v.remainingDays).toBe(12)
  })

  it("本地补录购买日时按精确时间比例折算", () => {
    const n = node({ price: 100, currency: "CNY", billing_cycle: "monthly", expires_at: new Date(NOW.getTime() + 20 * DAY).toISOString(), expires_in: 20 })
    const o = { purchased_at: new Date(NOW.getTime() - 10 * DAY).toISOString() }
    const v = computeValue(mergePrice(n, o), o, NOW)
    // 总周期 30 天，已过 10 天 → 剩 2/3
    expect(v.ratio).toBeCloseTo(2 / 3, 3)
    expect(v.remainingValue).toBeCloseTo(100 * (2 / 3), 2)
  })

  it("未设置到期但有价格：周期性按 null 剩余，不折算", () => {
    const n = node({ price: 50, currency: "CNY", billing_cycle: "monthly", expires_in: null, expires_at: null })
    const v = computeValue(mergePrice(n), null, NOW)
    expect(v.remainingValue).toBeNull()
    expect(v.daily).toBeCloseTo(50 / 30, 5)
  })
})

describe("mergePrice / 默认货币", () => {
  it("节点货币为空时用 default_currency 兜底", () => {
    const n = node({ currency: "" })
    const src = mergePrice(n)
    expect(src.currency).toBe("") // 尚未注入
  })
})

describe("periodTraffic / urgency / expiryAt", () => {
  it("month_used 优先", () => {
    expect(periodTraffic(node({ month_used: 100, month_rx: 999, month_tx: 999 }))).toBe(100)
    expect(periodTraffic(node({ month_rx: 30, month_tx: 12 }))).toBe(42)
    expect(periodTraffic(node({ month_used: undefined }))).toBe(0)
  })

  it("urgency 分级", () => {
    expect(urgency(null)).toBe("none")
    expect(urgency(-1)).toBe("expired")
    expect(urgency(3)).toBe("bad")
    expect(urgency(20)).toBe("warn")
    expect(urgency(90)).toBe("ok")
  })

  it("expiryAt 由 expires_in 推出未来日期", () => {
    const src = mergePrice(node({ expires_in: 1, expires_at: null }))
    const at = expiryAt(src, new Date("2026-09-24T00:30:00"))
    expect(at!.getFullYear()).toBe(2026)
    expect(at!.getMonth()).toBe(8)
    expect(at!.getDate()).toBe(25)
  })
})
