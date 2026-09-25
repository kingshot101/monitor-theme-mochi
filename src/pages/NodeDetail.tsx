import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { ArrowLeft, Cpu, Gauge, Globe2, Info, MemoryStick, Network, Server } from "lucide-react"
import { fetchHistory, startLive, useNodes } from "@/lib/api"
import type { History, Node, RangeKey } from "@/lib/types"
import { bytes, bps, cycleLabel, dateTimeStr, flagEmoji, money, osEmoji, pct, uptime } from "@/lib/format"
import { Badge, Button, Card, Progress, Segmented, Skeleton, StatusDot } from "@/components/ui"
import { MetricCharts, PingChart, probeColor } from "@/components/charts"
import { PriceTag, UptimeHint } from "@/components/parts"
import { ValueButton } from "@/value/ValueButton"
import { allocation, computeValue, mergePrice, periodTraffic, urgency } from "@/value/calc"
import { getOverride } from "@/value/store"

export function NodeDetailPage() {
  const { id } = useParams()
  const { t } = useTranslation()
  const { nodes } = useNodes()
  const node = useMemo(() => (nodes ?? []).find((n) => String(n.id) === id), [nodes, id])

  // 详情页可直接直达（刷新/外链），数据连接需在此兜底启动
  useEffect(() => {
    startLive()
  }, [])

  useEffect(() => {
    if (node) document.title = `${node.name} · ${document.title.split(" · ").pop() ?? "Mochi"}`
  }, [node])

  if (!nodes) {
    return (
      <div className="mx-auto max-w-7xl space-y-3 p-4">
        <Skeleton className="h-10 w-1/2" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-72" />
      </div>
    )
  }
  if (!node) {
    return (
      <div className="mx-auto max-w-7xl p-10 text-center text-sm text-fg-muted">
        404 · {t("site.noNodes")}
        <div className="mt-4">
          <Link to="/">
            <Button variant="soft" size="sm">
              <ArrowLeft size={13} /> {t("node.backHome")}
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return <Detail node={node} />
}

function Detail({ node }: { node: Node }) {
  const { t, i18n } = useTranslation()
  const [range, setRange] = useState<RangeKey>("24h")
  const [history, setHistory] = useState<History | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let on = true
    setLoading(true)
    setError("")
    // metrics 与 ping 分两次并行拉（series 参数决定 hub 返回哪类序列）
    Promise.all([
      fetchHistory(node.id, range, "metrics", 240),
      fetchHistory(node.id, range, "ping", 240).catch(() => null),
    ])
      .then(([m, p]) => {
        if (!on) return
        setHistory({
          metrics: m.metrics,
          ping: p?.ping ?? [],
          probes: p?.probes ?? {},
          loss: p?.loss,
        })
      })
      .catch((e) => on && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => on && setLoading(false))
    return () => {
      on = false
    }
  }, [node.id, range])

  const m = node.metrics
  const v = computeValue(mergePrice(node, getOverride(node.id)), getOverride(node.id))
  const allo = allocation(v, node)
  const traffic = periodTraffic(node)
  const limit = node.traffic_limit > 0 ? node.traffic_limit : null
  const u = urgency(v.remainingDays)
  const rangeHours = range === "1h" ? 1 : range === "6h" ? 6 : range === "24h" ? 24 : 168

  return (
    <div className="mx-auto max-w-7xl space-y-3 p-4">
      {/* 返回 + 头部 */}
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft size={14} /> {t("node.backHome")}
          </Button>
        </Link>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <StatusDot online={node.online} size={10} />
          <span className="text-xl">{flagEmoji(node.country)}</span>
          <h1 className="text-lg font-bold">{node.name}</h1>
          <span className="text-base">{osEmoji(node.os)}</span>
          {node.group && <Badge>{node.group}</Badge>}
          <Badge>{node.arch}</Badge>
          <Badge>{node.virt}</Badge>
          <PriceTag node={node} />
          <ExpiryBadgeMini node={node} />
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] text-fg-muted tnum">
              {t("node.uptime")} {uptime(m?.uptime)}
            </span>
            <ValueButton node={node} />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-fg-muted tnum">
          <span>{node.cpu_name} · {node.cpu_cores}C</span>
          <span>{bytes(node.mem_total)}</span>
          <span>{bytes(node.disk_total)}</span>
          <span>{node.os} {node.kernel}</span>
          <span>agent {node.agent_version}</span>
          <span>
            <span className="text-good">↓{bps(m?.net_rx)}</span>{" "}
            <span className="text-primary">↑{bps(m?.net_tx)}</span>
          </span>
          <span>{t("node.lastSeen")} {dateTimeStr(node.last_seen)}</span>
        </div>
      </Card>

      {/* 剩余价值卡（详情页内联版） */}
      {(v.hasPrice || v.remainingDays != null) && (
        <Card className="p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <div className="text-xs text-fg-muted">{t("value.remainingValue")}</div>
              {v.hasPrice ? (
                <>
                  <div className="mt-1 text-2xl font-bold tnum text-primary">
                    {v.isOnce ? money(v.remainingValue ?? v.price, v.currency) : money(v.remainingValue, v.currency)}
                  </div>
                  <div className="mt-1 text-[11px] text-fg-muted tnum">
                    {money(v.price, v.currency)} · {cycleLabel(v.billing_cycle, i18n.language)}
                    {!v.isOnce && v.daily != null && ` · ${t("value.daily")} ${money(v.daily, v.currency)}`}
                  </div>
                </>
              ) : (
                <div className="mt-1 text-sm text-fg-muted">{t("value.noPrice")}</div>
              )}
            </div>
            <div>
              <div className="text-xs text-fg-muted">{t("value.expiry")}</div>
              <div className={`mt-1 text-sm font-bold tnum ${u === "expired" || u === "bad" ? "text-bad" : u === "warn" ? "text-warn" : ""}`}>
                {v.remainingDays == null
                  ? t("value.noExpiry")
                  : v.remainingDays < 0
                    ? t("value.expiredDays", { n: -v.remainingDays })
                    : `${v.remainingDays} ${t("value.daysUnit")}`}
              </div>
              {v.ratio != null && (
                <div className="mt-2 max-w-40">
                  <Progress value={v.ratio * 100} tone={u === "expired" || u === "bad" ? "bad" : u === "warn" ? "warn" : "good"} />
                </div>
              )}
            </div>
            <div>
              <div className="text-xs text-fg-muted">{t("value.trafficOfPeriod")}</div>
              <div className="mt-1 text-sm font-bold tnum">
                {traffic != null
                  ? limit
                    ? `${bytes(traffic)} / ${bytes(limit)}`
                    : bytes(traffic)
                  : "—"}
              </div>
              {limit && traffic != null && (
                <div className="mt-2 max-w-40">
                  <Progress value={(traffic / limit) * 100} />
                </div>
              )}
            </div>
          </div>
          {v.hasPrice && !v.isOnce && (allo.cores || allo.memGB || allo.diskGB) && (
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
              <Badge>{t("value.perCore")} {allo.cores ? money(allo.cores, v.currency) : "—"}</Badge>
              <Badge>{t("value.perGBMem")} {allo.memGB ? money(allo.memGB, v.currency) : "—"}</Badge>
              <Badge>{t("value.perGBDisk")} {allo.diskGB ? money(allo.diskGB, v.currency) : "—"}</Badge>
            </div>
          )}
        </Card>
      )}

      {/* 历史图表 */}
      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-bold">
            <Gauge size={15} className="text-primary" /> {t("node.history")}
          </h2>
          <Segmented
            value={range}
            onChange={setRange}
            options={[
              { value: "1h", label: t("node.range1h") },
              { value: "6h", label: t("node.range6h") },
              { value: "24h", label: t("node.range24h") },
              { value: "7d", label: t("node.range7d") },
            ]}
          />
        </div>
        {error ? (
          <div className="flex h-32 items-center justify-center text-xs text-bad">{error}</div>
        ) : loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-line border-t-primary" />
          </div>
        ) : (
          <MetricCharts history={history} rangeHours={rangeHours} memTotal={node.mem_total} diskTotal={node.disk_total} />
        )}
      </Card>

      {/* 网络质量 */}
      <Card className="p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-bold">
            <Network size={15} className="text-primary" /> {t("node.ping")}
          </h2>
          {Object.entries(history?.loss ?? {}).map(([id, l]) => (
            <Badge key={id} tone={l >= 10 ? "bad" : l > 0 ? "warn" : "good"} className="tnum">
              {(history?.probes?.[id] ?? id).slice(0, 14)} · {t("node.loss")} {l.toFixed(1)}%
            </Badge>
          ))}
          {Object.keys(history?.probes ?? {}).map((id, i) => (
            <span key={id} className="flex items-center gap-1 text-[10px] text-fg-muted">
              <i className="h-2 w-2 rounded-full" style={{ background: probeColor(i) }} />
              {(history?.probes?.[id] ?? id).slice(0, 14)}
            </span>
          ))}
        </div>
        <PingChart history={history} rangeHours={rangeHours} height={200} />
      </Card>

      {/* 系统信息 */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <InfoCard icon={<Server size={14} className="text-primary" />} title={t("node.system")} rows={[
          [t("node.os"), `${node.os} ${node.kernel}`],
          [t("node.arch"), node.arch],
          [t("node.virt"), node.virt],
          [t("node.agent"), node.agent_version],
        ]} />
        <InfoCard icon={<Cpu size={14} className="text-primary" />} title={t("node.config")} rows={[
          ["CPU", `${node.cpu_name} · ${node.cpu_cores}C`],
          [t("node.mem"), bytes(node.mem_total)],
          [t("node.swap"), bytes(node.swap_total)],
          [t("node.disk"), bytes(node.disk_total)],
        ]} />
        <InfoCard icon={<Globe2 size={14} className="text-primary" />} title={t("node.network")} rows={[
          [t("node.totalDown"), bytes(node.total_rx)],
          [t("node.totalUp"), bytes(node.total_tx)],
          [t("node.monthUsed"), bytes(node.month_used ?? (node.month_rx ?? 0) + (node.month_tx ?? 0))],
          ["TCP / UDP / " + t("node.procs"), m ? `${m.tcp} / ${m.udp} / ${m.procs}` : "—"],
        ]} />
      </div>
    </div>
  )
}

function ExpiryBadgeMini({ node }: { node: Node }) {
  const { t } = useTranslation()
  const v = computeValue(mergePrice(node, getOverride(node.id)))
  if (v.remainingDays == null) return <Badge>{t("value.noExpiry")}</Badge>
  const u = urgency(v.remainingDays)
  return (
    <Badge tone={u === "expired" || u === "bad" ? "bad" : u === "warn" ? "warn" : "good"} className="tnum">
      {v.remainingDays < 0
        ? t("node.expiredDays", { n: -v.remainingDays })
        : v.remainingDays === 0
          ? t("node.expiringToday")
          : t("node.expiresInDays", { n: v.remainingDays })}
    </Badge>
  )
}

function InfoCard({
  icon,
  title,
  rows,
}: {
  icon: React.ReactNode
  title: string
  rows: [string, string][]
}) {
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-bold">
        {icon} {title}
      </div>
      <div className="space-y-1.5">
        {rows.map(([k, val]) => (
          <div key={k} className="flex items-baseline justify-between gap-2 text-[11px]">
            <span className="text-fg-muted">{k}</span>
            <span className="truncate text-right font-medium tnum" title={val}>
              {val || "—"}
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}
