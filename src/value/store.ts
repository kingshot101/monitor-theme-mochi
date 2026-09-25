import { useCallback, useSyncExternalStore } from "react"
import { emitKey, loadLS, saveLS, snapshotKey, subscribeKey } from "@/lib/prefs"
import type { Override } from "./calc"

const OVERRIDES_KEY = "value.overrides"
const RATES_KEY = "value.rates"
const BASE_KEY = "value.base"

/** 每节点本地补录/覆盖：nodeId → Override */
export type Overrides = Record<string, Override>

// useSyncExternalStore 要求快照引用稳定（Object.is 比较），解析结果必须缓存
let overridesCache: Overrides | null = null
let ratesCache: Rates | null = null

function cachedOverrides(): Overrides {
  if (!overridesCache) overridesCache = loadLS<Overrides>(OVERRIDES_KEY, {})
  return overridesCache
}

function cachedRates(): Rates {
  if (!ratesCache) ratesCache = loadLS<Rates>(RATES_KEY, {})
  return ratesCache
}

export function getOverrides(): Overrides {
  return cachedOverrides()
}

export function getOverride(nodeId: number | string): Override | undefined {
  return cachedOverrides()[String(nodeId)]
}

export function setOverride(nodeId: number | string, o: Override | null) {
  const all = { ...cachedOverrides() }
  const key = String(nodeId)
  if (o == null || Object.keys(o).length === 0) delete all[key]
  else all[key] = o
  overridesCache = all
  saveLS(OVERRIDES_KEY, all)
  emitKey(OVERRIDES_KEY)
}

export function useOverrides(): [Overrides, (nodeId: number | string, o: Override | null) => void] {
  const value = useSyncExternalStore(
    (l) => subscribeKey(OVERRIDES_KEY, l),
    cachedOverrides,
    () => ({}) as Overrides,
  )
  const set = useCallback((nodeId: number | string, o: Override | null) => setOverride(nodeId, o), [])
  return [value, set]
}

/* ------------------------------- 汇总换算设置 ------------------------------- */

export const KNOWN_CURRENCIES = [
  "CNY", "USD", "EUR", "GBP", "JPY", "HKD", "TWD", "SGD", "KRW", "RUB", "INR", "AUD", "CAD",
] as const

export function getBaseCurrency(): string {
  return loadLS<string>(BASE_KEY, "CNY")
}

export function setBaseCurrency(c: string) {
  saveLS(BASE_KEY, c)
  emitKey(RATES_KEY)
}

/** 手动汇率表：1 单位该货币 = ? 单位基准货币 */
export type Rates = Record<string, number>

export function getRates(): Rates {
  return cachedRates()
}

export function setRate(currency: string, rate: number | null) {
  const r = { ...cachedRates() }
  if (rate == null || !isFinite(rate) || rate <= 0) delete r[currency]
  else r[currency] = rate
  ratesCache = r
  saveLS(RATES_KEY, r)
  emitKey(RATES_KEY)
}

export function useRates(): {
  base: string
  rates: Rates
  setBase: (c: string) => void
  setRate: (c: string, rate: number | null) => void
  /** 该货币 → 基准货币 的汇率；基准本身恒为 1；未设置返回 undefined */
  rateOf: (c: string) => number | undefined
} {
  const rates = useSyncExternalStore(
    (l) => subscribeKey(RATES_KEY, l),
    cachedRates,
    () => ({}) as Rates,
  )
  const base = useSyncExternalStore(
    (l) => subscribeKey(BASE_KEY, l),
    () => snapshotKey<string>(BASE_KEY, "CNY"),
    () => "CNY",
  )
  const rateOf = (c: string) => {
    const cur = (c || "").toUpperCase()
    if (!cur) return undefined
    if (cur === base.toUpperCase()) return 1
    return rates[cur]
  }
  const setBase = useCallback((c: string) => setBaseCurrency(c), [])
  const setRateCb = useCallback((c: string, rate: number | null) => setRate(c, rate), [])
  return { base, rates, setBase, setRate: setRateCb, rateOf }
}
