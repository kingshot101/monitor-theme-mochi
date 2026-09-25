import { lazy, Suspense, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import type { Node } from "@/lib/types"
import { bytes, bps, flagEmoji, uptime } from "@/lib/format"
import { Badge, Card, StatusDot, cx } from "@/components/ui"
import { COUNTRY_CENTERS } from "@/lib/countryCenters"
import { ValueButton } from "./parts"

// globe.gl + three 体积大，切到地球视图时才加载
const EarthInner = lazy(() => import("./EarthInner"))

export function EarthView({ nodes }: { nodes: Node[] }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-[420px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-primary" />
        </div>
      }
    >
      <EarthInner nodes={nodes} />
    </Suspense>
  )
}

/** 国家聚合后的点位类型 */
export type CountryPoint = {
  cc: string
  lat: number
  lng: number
  count: number
  online: number
  names: string[]
}

export function aggregateByCountry(nodes: Node[]): CountryPoint[] {
  const by = new Map<string, { count: number; online: number; names: string[] }>()
  for (const n of nodes) {
    const cc = (n.country || "").toUpperCase()
    if (!cc) continue
    const e = by.get(cc) ?? { count: 0, online: 0, names: [] }
    e.count++
    if (n.online) e.online++
    e.names.push(n.name)
    by.set(cc, e)
  }
  return [...by.entries()]
    .filter(([cc]) => COUNTRY_CENTERS[cc])
    .map(([cc, e]) => ({ cc, lat: COUNTRY_CENTERS[cc][0], lng: COUNTRY_CENTERS[cc][1], ...e }))
}

export function pointColor(p: { count: number; online: number }): string {
  if (p.online === 0) return "#ef4444"
  if (p.online < p.count) return "#f59e0b"
  return "#22c55e"
}

export function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

/** 选中国家的节点列表（地球下方） */
export function CountryNodeList({ nodes, cc }: { nodes: Node[]; cc: string | null }) {
  const { t } = useTranslation()
  const list = useMemo(
    () => (cc ? nodes.filter((n) => (n.country || "").toUpperCase() === cc) : []),
    [nodes, cc],
  )
  if (!cc || !list.length) return null
  return (
    <Card className="mt-3 divide-y divide-line p-0">
      <div className="px-4 py-2.5 text-xs font-semibold">
        {flagEmoji(cc)} {cc} · {list.length}
      </div>
      {list.map((n) => (
        <div key={n.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
          <StatusDot online={n.online} size={7} />
          <span className="min-w-0 flex-1 truncate font-medium">{n.name}</span>
          <span className="tnum hidden text-fg-muted sm:inline">{uptime(n.metrics?.uptime)}</span>
          <span className="tnum hidden text-fg-muted md:inline">
            ↓{bps(n.metrics?.net_rx)} ↑{bps(n.metrics?.net_tx)}
          </span>
          <span className="tnum hidden text-fg-muted/70 lg:inline">
            {bytes(n.month_used ?? (n.month_rx ?? 0) + (n.month_tx ?? 0))}
          </span>
          <ValueButton node={n} />
        </div>
      ))}
    </Card>
  )
}

export function Loading({ className }: { className?: string }) {
  return (
    <div className={cx("flex items-center justify-center", className)}>
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-primary" />
    </div>
  )
}
