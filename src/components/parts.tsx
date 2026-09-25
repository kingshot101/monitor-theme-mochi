import { useTranslation } from "react-i18next"
import type { Node } from "@/lib/types"
import { bytes, bps, cycleLabel, flagEmoji, money, osEmoji, pct, uptime } from "@/lib/format"
import { Badge, Progress, StatusDot } from "@/components/ui"
import { periodTraffic } from "@/value/calc"
import { getOverride } from "@/value/store"
import { ValueButton } from "@/value/ValueButton"
import { ExpiryBadge } from "@/value/ValueButton"

/** 节点名行：国旗 + 名称 + 系统 emoji + 状态点 */
export function NodeName({ node, bold = true }: { node: Node; bold?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <StatusDot online={node.online} size={7} />
      <span className="shrink-0 text-[13px] leading-none">{flagEmoji(node.country)}</span>
      <span className={`truncate ${bold ? "font-semibold" : ""}`}>{node.name}</span>
      <span className="shrink-0 text-[11px] opacity-70" title={node.os}>
        {osEmoji(node.os)}
      </span>
    </span>
  )
}

/** 价格标签（mochi PriceTags 还原）：后台价或本地补录价 + 周期 */
export function PriceTag({ node }: { node: Node }) {
  const { i18n } = useTranslation()
  const o = getOverride(node.id)
  const price = o?.price ?? (node.price > 0 ? node.price : 0)
  const currency = o?.currency || node.currency || ""
  const cycle = o?.billing_cycle || node.billing_cycle || ""
  if (!price) return null
  return (
    <Badge tone="primary" className="tnum">
      {money(price, currency)}
      {cycle ? ` / ${cycleLabel(cycle, i18n.language)}` : ""}
    </Badge>
  )
}

/** 单条指标（Compact/Classic 用）：format="percent" 显示百分比（CPU），"bytes" 显示字节数 */
export function MetricBar({
  label,
  used,
  total,
  digits = 1,
  format = "bytes",
}: {
  label: string
  used: number | null | undefined
  total: number | null | undefined
  digits?: number
  format?: "bytes" | "percent"
}) {
  const p =
    used != null && total ? Math.min(100, (used / total) * 100) : null
  const valueText =
    used == null ? "—" : format === "percent" ? pct(used, 0) : bytes(used, digits)
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-baseline justify-between gap-1 text-[10px] text-fg-muted">
        <span>{label}</span>
        <span className="tnum">{p != null ? pct(p, 0) : "—"}</span>
      </div>
      <Progress value={p ?? 0} />
      <div className="mt-1 truncate text-right text-[10px] text-fg-muted/80 tnum">
        {format === "percent"
          ? valueText
          : used != null
            ? `${bytes(used, digits)} / ${bytes(total)}`
            : "—"}
      </div>
    </div>
  )
}

/** 网络速率小行 */
export function NetRow({ node }: { node: Node }) {
  const m = node.metrics
  return (
    <div className="flex items-center gap-2 text-[11px] text-fg-muted tnum">
      <span className="flex items-center gap-0.5">
        <span className="text-good">↓</span>
        {bps(m?.net_rx)}
      </span>
      <span className="flex items-center gap-0.5">
        <span className="text-primary">↑</span>
        {bps(m?.net_tx)}
      </span>
    </div>
  )
}

/** 本期流量小行 */
export function TrafficHint({ node }: { node: Node }) {
  const used = periodTraffic(node)
  if (used == null) return null
  const limit = node.traffic_limit > 0 ? node.traffic_limit : null
  return (
    <span className="tnum text-[11px] text-fg-muted">
      {limit ? `${bytes(used)} / ${bytes(limit)}` : bytes(used)}
    </span>
  )
}

export function UptimeHint({ node }: { node: Node }) {
  return <span className="tnum text-[11px] text-fg-muted">{uptime(node.metrics?.uptime)}</span>
}

export { ValueButton, ExpiryBadge }
