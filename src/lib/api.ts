import { useEffect, useState, useSyncExternalStore } from "react"
import type { History, Me, Node, RangeKey, ThemeConfig } from "./types"
import { RANGE_HOURS } from "./types"

/* ---------------------------------- 请求 ---------------------------------- */

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, init)
  if (!r.ok) {
    let msg = `HTTP ${r.status}`
    try {
      const j = await r.json()
      if (j && typeof j.error === "string") msg = j.error
    } catch {
      /* 忽略非 JSON 响应体 */
    }
    throw new Error(msg)
  }
  return (await r.json()) as T
}

/* ------------------------------- 节点实时数据 ------------------------------ */

type NodesState = {
  nodes: Node[] | null
  error: string
  /** ws 是否处于连接状态 */
  live: boolean
  /** 服务端是否已关闭公开页（/api/me public_page=false 时由调用方处理） */
  everLoaded: boolean
}

let state: NodesState = { nodes: null, error: "", live: false, everLoaded: false }
const listeners = new Set<() => void>()

function emit(patch: Partial<NodesState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useNodes(): NodesState {
  return useSyncExternalStore(subscribe, () => state)
}

let started = false

/** 全站只建一条 ws；断开后 5s 轮询兜底并指数退避重连 */
export function startLive() {
  if (started) return
  started = true

  let ws: WebSocket | null = null
  let poll: ReturnType<typeof setInterval> | null = null
  let retry: ReturnType<typeof setTimeout> | null = null
  let backoff = 1000
  let closedByUs = false

  const stopPoll = () => {
    if (poll) clearInterval(poll)
    poll = null
  }
  const startPoll = () => {
    if (poll) return
    poll = setInterval(refreshOnce, 5000)
    refreshOnce()
  }

  async function refreshOnce() {
    try {
      const j = await req<{ nodes: Node[] }>("/api/nodes")
      ingest(j.nodes)
      emit({ error: "" })
    } catch (e) {
      emit({ error: e instanceof Error ? e.message : String(e) })
    }
  }

  function ingest(nodes: Node[]) {
    pushSpeed(nodes)
    emit({ nodes, error: "", everLoaded: true })
  }

  function connect() {
    if (closedByUs) return
    try {
      ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/ws`)
    } catch {
      startPoll()
      scheduleRetry()
      return
    }
    ws.onopen = () => {
      backoff = 1000
      stopPoll()
      emit({ live: true })
    }
    ws.onmessage = (ev) => {
      try {
        const j = JSON.parse(ev.data as string)
        if (Array.isArray(j?.nodes)) ingest(j.nodes)
      } catch {
        /* 非 JSON 帧忽略 */
      }
    }
    ws.onclose = () => {
      emit({ live: false })
      ws = null
      if (closedByUs) return
      startPoll()
      scheduleRetry()
    }
    ws.onerror = () => ws?.close()
  }

  function scheduleRetry() {
    if (retry) clearTimeout(retry)
    retry = setTimeout(() => {
      backoff = Math.min(backoff * 2, 15000)
      connect()
    }, backoff)
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      if (!ws || ws.readyState > WebSocket.OPEN) {
        startPoll()
        scheduleRetry()
      }
    }
  })

  connect()
  startPoll()
}

/* --------------------------- 上下行速率历史（汇总） --------------------------- */

export type SpeedPoint = { t: number; rx: number; tx: number }
const SPEED_KEEP = 60
const speedHist = new Map<string, SpeedPoint[]>()

function pushSpeed(nodes: Node[]) {
  const sums = new Map<string, { rx: number; tx: number; t: number }>()
  for (const n of nodes) {
    const key = n.group ?? ""
    const m = n.metrics
    if (!m) continue
    const cur = sums.get(key) ?? { rx: 0, tx: 0, t: 0 }
    cur.rx += m.net_rx || 0
    cur.tx += m.net_tx || 0
    sums.set(key, cur)
  }
  const t = Date.now()
  for (const [key, s] of sums) {
    const arr = speedHist.get(key) ?? []
    arr.push({ t, rx: s.rx, tx: s.tx })
    if (arr.length > SPEED_KEEP) arr.splice(0, arr.length - SPEED_KEEP)
    speedHist.set(key, arr)
  }
  speedHist.set("__all__", mergeAll(t))
}

function mergeAll(t: number): SpeedPoint[] {
  // 以最长的分组序列为骨架，逐点对齐相加
  let longest: SpeedPoint[] = []
  for (const [k, v] of speedHist) {
    if (k !== "__all__" && v.length > longest.length) longest = v
  }
  if (!longest.length) return []
  return longest.map((p, i) => {
    let rx = 0
    let tx = 0
    for (const [k, v] of speedHist) {
      if (k === "__all__") continue
      const q = v[v.length - longest.length + i]
      if (q && Math.abs(q.t - p.t) < 4000) {
        rx += q.rx
        tx += q.tx
      }
    }
    return { t, rx, tx }
  })
}

export function speedHistory(key: string | null): SpeedPoint[] {
  return speedHist.get(key ?? "__all__") ?? []
}

/* --------------------------------- 其他 API -------------------------------- */

export async function fetchMe(): Promise<Me> {
  return req<Me>("/api/me")
}

export async function fetchThemeConfig(short: string): Promise<ThemeConfig> {
  return req<ThemeConfig>(`/api/themes/${encodeURIComponent(short)}/config`)
}

export async function fetchHistory(
  id: number | string,
  range: RangeKey,
  series: "metrics" | "ping",
  width = 240,
): Promise<History> {
  const hours = RANGE_HOURS[range]
  const points = Math.max(60, Math.min(300, Math.round(width)))
  return req<History>(
    `/api/nodes/${id}/metrics?hours=${hours}&points=${points}&series=${series}`,
  )
}

/* ---------------------------------- hooks --------------------------------- */

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): { data: T | null; error: string } {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState("")
  useEffect(() => {
    let on = true
    fn()
      .then((d) => on && (setData(d), setError("")))
      .catch((e) => on && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      on = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return { data, error }
}
