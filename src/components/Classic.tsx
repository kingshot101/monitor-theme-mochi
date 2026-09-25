import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import type { Node } from "@/lib/types"
import { bytes, bps, pct, uptime } from "@/lib/format"
import { Badge, Card, Progress, StatusDot } from "@/components/ui"
import { ExpiryBadge, NetRow, OsLogo, PriceTag, TrafficHint, UptimeHint, ValueButton } from "./parts"
import { flagEmoji } from "@/lib/format"

/** Classic 视图：官方默认风格的列表（还原 monitor 官方列表观感） */
export function ClassicView({ nodes }: { nodes: Node[] }) {
  const nav = useNavigate()
  return (
    <Card className="divide-y divide-line overflow-hidden p-0">
      {nodes.map((n) => (
        <div
          key={n.id}
          onClick={() => nav(`/instance/${n.id}`)}
          className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 transition-colors hover:bg-card-soft"
        >
          <div className="flex min-w-44 flex-1 items-center gap-2">
            <StatusDot online={n.online} size={7} />
            <span className="text-[13px]">{flagEmoji(n.country)}</span>
            <span className="truncate text-sm font-semibold">{n.name}</span>
            <OsLogo os={n.os} className="h-3.5 w-3.5 opacity-80" />
            {n.group ? <Badge>{n.group}</Badge> : null}
          </div>

          <div className="hidden w-28 shrink-0 sm:block">
            <div className="text-[10px] text-fg-muted">{uptime(n.metrics?.uptime)}</div>
            <div className="text-[10px] text-fg-muted/70">{n.os}</div>
          </div>

          <Gauge label="CPU" value={n.metrics?.cpu ?? null} />
          <Gauge
            label="MEM"
            value={n.metrics ? (n.metrics.mem_used / (n.metrics.mem_total || 1)) * 100 : null}
            hint={n.metrics ? bytes(n.metrics.mem_used, 0) : undefined}
          />
          <Gauge
            label="DISK"
            value={n.metrics ? (n.metrics.disk_used / (n.metrics.disk_total || 1)) * 100 : null}
            hint={n.metrics ? bytes(n.metrics.disk_used, 0) : undefined}
          />

          <div className="w-32 shrink-0">
            <NetRow node={n} />
            <div className="mt-0.5 flex items-center gap-2 text-[10px] text-fg-muted/80 tnum">
              <TrafficHint node={n} />
              <span>↓{bytes(n.total_rx, 0)}</span>
              <span>↑{bytes(n.total_tx, 0)}</span>
            </div>
          </div>

          <div className="ml-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-1.5">
            <PriceTag node={n} />
            <ExpiryBadge node={n} />
            <ValueButton node={n} />
          </div>
        </div>
      ))}
    </Card>
  )
}

function Gauge({ label, value, hint }: { label: string; value: number | null; hint?: string }) {
  return (
    <div className="w-20 shrink-0">
      <div className="flex items-baseline justify-between text-[10px] text-fg-muted">
        <span>{label}</span>
        <span className="tnum">{pct(value, 0)}</span>
      </div>
      <Progress value={value ?? 0} />
      {hint && <div className="mt-0.5 text-right text-[10px] text-fg-muted/70 tnum">{hint}</div>}
    </div>
  )
}

/** Detailed 视图：完整表格 */
export function DetailedView({ nodes }: { nodes: Node[] }) {
  const { t } = useTranslation()
  const nav = useNavigate()
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[860px] text-left text-xs">
        <thead>
          <tr className="border-b border-line text-[11px] text-fg-muted">
            <th className="px-4 py-2.5 font-medium">{t("site.nodes")}</th>
            <th className="px-3 py-2.5 font-medium">{t("node.uptime")}</th>
            <th className="px-3 py-2.5 font-medium">{t("node.cpu")}</th>
            <th className="px-3 py-2.5 font-medium">{t("node.mem")}</th>
            <th className="px-3 py-2.5 font-medium">{t("node.disk")}</th>
            <th className="px-3 py-2.5 font-medium">↓/↑</th>
            <th className="px-3 py-2.5 font-medium">{t("node.monthUsed")}</th>
            <th className="px-3 py-2.5 font-medium">{t("value.expiry")}</th>
            <th className="px-3 py-2.5 font-medium">{t("value.module")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {nodes.map((n) => {
            const m = n.metrics
            return (
              <tr
                key={n.id}
                onClick={() => nav(`/instance/${n.id}`)}
                className="cursor-pointer transition-colors hover:bg-card-soft"
              >
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2">
                    <StatusDot online={n.online} size={7} />
                    <span>{flagEmoji(n.country)}</span>
                    <span className="font-semibold">{n.name}</span>
                    <OsLogo os={n.os} className="h-3.5 w-3.5 opacity-80" />
                    <span className="text-[10px] text-fg-muted">{n.cpu_cores}C · {bytes(n.mem_total, 0)}</span>
                  </span>
                </td>
                <td className="px-3 py-2.5 tnum text-fg-muted">{uptime(m?.uptime)}</td>
                <TdPct value={m?.cpu ?? null} />
                <TdPct value={m ? (m.mem_used / (m.mem_total || 1)) * 100 : null} hint={m ? bytes(m.mem_used, 0) : undefined} />
                <TdPct value={m ? (m.disk_used / (m.disk_total || 1)) * 100 : null} hint={m ? bytes(m.disk_used, 0) : undefined} />
                <td className="px-3 py-2.5">
                  <div className="tnum">
                    <div className="text-good">{bps(m?.net_rx)}</div>
                    <div className="text-primary">{bps(m?.net_tx)}</div>
                  </div>
                </td>
                <td className="px-3 py-2.5 tnum text-fg-muted">
                  {bytes(n.month_used ?? (n.month_rx ?? 0) + (n.month_tx ?? 0))}
                </td>
                <td className="px-3 py-2.5">
                  <ExpiryBadge node={n} />
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <PriceTag node={n} />
                    <ValueButton node={n} />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Card>
  )
}

function TdPct({ value, hint }: { value: number | null; hint?: string }) {
  return (
    <td className="px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="tnum w-10">{pct(value, 0)}</span>
        <div className="w-14">
          <Progress value={value ?? 0} />
        </div>
        {hint && <span className="tnum text-[10px] text-fg-muted/70">{hint}</span>}
      </div>
    </td>
  )
}
