import { useMemo } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { useTranslation } from "react-i18next"
import type { History, PingPoint } from "@/lib/types"
import { bytes } from "@/lib/format"
import { cssVar } from "./ui"

/** 强调色（跟随后台 accent 配置，渲染时读取 CSS 变量） */
export const accentColor = () => cssVar("--primary", "#fbbf24")

export const PROBE_COLORS = [
  "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6",
  "#14b8a6", "#ef4444", "#06b6d4", "#f97316", "#84cc16",
  "#a855f7", "#0ea5e9",
]

/** 探测线配色：第一条用强调色，其余走固定色板 */
export const probeColor = (i: number) =>
  i === 0 ? accentColor() : PROBE_COLORS[(i - 1) % PROBE_COLORS.length]

const timeTick = (ts: number, rangeHours: number) => {
  const d = new Date(ts * 1000)
  const p = (x: number) => String(x).padStart(2, "0")
  if (rangeHours <= 24) return `${p(d.getHours())}:${p(d.getMinutes())}`
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}时`
}

const tooltipStyle = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 11,
  color: "var(--fg)",
}

/** ping 小多图：每个探测目标一条线，超时留空档 */
export function PingChart({
  history,
  height = 180,
  rangeHours = 1,
  showLegend = true,
}: {
  history: History | null
  height?: number
  rangeHours?: number
  showLegend?: boolean
}) {
  const { t } = useTranslation()
  const { data, probes } = useMemo(() => {
    if (!history) return { data: [] as Record<string, number | null | number>[], probes: [] as [string, string][] }
    const byTs = new Map<number, Record<string, number | null | number>>()
    for (const p of history.ping as PingPoint[]) {
      const row = byTs.get(p.ts) ?? { ts: p.ts }
      row[p.task_id] = p.latency
      byTs.set(p.ts, row)
    }
    const rows = [...byTs.values()].sort((a, b) => (a.ts as number) - (b.ts as number))
    const probes = Object.entries(history.probes ?? {})
    return { data: rows, probes }
  }, [history])

  if (!history || !probes.length) {
    return (
      <div className="flex h-32 items-center justify-center text-xs text-fg-muted">{t("node.noPing")}</div>
    )
  }

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 6" vertical={false} />
          <XAxis
            dataKey="ts"
            tickFormatter={(v) => timeTick(v, rangeHours)}
            tick={{ fontSize: 10, fill: "var(--fg-muted)" }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
            minTickGap={40}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--fg-muted)" }}
            axisLine={false}
            tickLine={false}
            width={46}
            unit="ms"
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(v) => timeTick(Number(v), rangeHours)}
            formatter={
              ((value: number | null, name: string) => [
                value == null ? t("node.loss") : `${Number(value).toFixed(1)} ${t("node.ms")}`,
                probes.find(([id]) => id === name)?.[1] ?? name,
              ]) as never
            }
          />
          {showLegend && (
            <Legend payload={probes.map(([id, name], i) => ({ value: name, type: "line", id, color: probeColor(i) }))} />
          )}
          {probes.map(([id], i) => (
            <Line
              key={id}
              type="monotone"
              dataKey={id}
              stroke={probeColor(i)}
              strokeWidth={1.6}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** 详情页历史图表：CPU / 内存 / 磁盘 / 网络（总量由调用方按节点配置传入） */
export function MetricCharts({
  history,
  rangeHours = 24,
  memTotal = 0,
  diskTotal = 0,
}: {
  history: History | null
  rangeHours?: number
  memTotal?: number
  diskTotal?: number
}) {
  const { t } = useTranslation()
  if (!history || !history.metrics?.length) {
    return <div className="flex h-32 items-center justify-center text-xs text-fg-muted">{t("node.noHistory")}</div>
  }
  const rows = history.metrics.map((p) => ({
    ts: p.ts,
    cpu: p.cpu,
    mem: memTotal ? (p.mem_used / memTotal) * 100 : null,
    disk: diskTotal ? (p.disk_used / diskTotal) * 100 : null,
    rx: p.net_rx,
    tx: p.net_tx,
  }))
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel title={t("node.cpuHistory")}>
        <MiniArea rows={rows} dataKeys={["cpu"]} rangeHours={rangeHours} unit="%" max={100} colors={[accentColor()]} />
      </Panel>
      <Panel title={t("node.memHistory")}>
        <MiniArea rows={rows} dataKeys={["mem"]} rangeHours={rangeHours} unit="%" max={100} colors={["#3b82f6"]} />
      </Panel>
      <Panel title={t("node.diskHistory")}>
        <MiniArea rows={rows} dataKeys={["disk"]} rangeHours={rangeHours} unit="%" max={100} colors={["#8b5cf6"]} />
      </Panel>
      <Panel title={t("node.netHistory")}>
        <NetChart rows={rows} rangeHours={rangeHours} />
      </Panel>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-card p-3">
      <div className="mb-1 text-xs font-semibold text-fg-muted">{title}</div>
      {children}
    </div>
  )
}

function MiniArea({
  rows,
  dataKeys,
  rangeHours,
  unit,
  max,
  colors,
}: {
  rows: Record<string, number | null | number>[]
  dataKeys: string[]
  rangeHours: number
  unit: string
  max?: number
  colors: string[]
}) {
  return (
    <div style={{ height: 170 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 6" vertical={false} />
          <XAxis
            dataKey="ts"
            tickFormatter={(v) => timeTick(v, rangeHours)}
            tick={{ fontSize: 10, fill: "var(--fg-muted)" }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
            minTickGap={40}
          />
          <YAxis
            domain={[0, max ?? "auto"]}
            unit={unit}
            tick={{ fontSize: 10, fill: "var(--fg-muted)" }}
            axisLine={false}
            tickLine={false}
            width={46}
          />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => timeTick(Number(v), rangeHours)} />
          {dataKeys.map((k, i) => (
            <Area
              key={k}
              type="monotone"
              dataKey={k}
              stroke={colors[i]}
              fill={colors[i]}
              fillOpacity={0.14}
              strokeWidth={1.6}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function NetChart({ rows, rangeHours }: { rows: Record<string, number | null | number>[]; rangeHours: number }) {
  const { t } = useTranslation()
  const scaled = rows.map((r) => ({
    ts: r.ts,
    down: (r.rx as number) / 1024 ** 2,
    up: (r.tx as number) / 1024 ** 2,
  }))
  return (
    <div style={{ height: 170 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={scaled} margin={{ top: 6, right: 8, bottom: 0, left: -10 }}>
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 6" vertical={false} />
          <XAxis
            dataKey="ts"
            tickFormatter={(v) => timeTick(v, rangeHours)}
            tick={{ fontSize: 10, fill: "var(--fg-muted)" }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
            minTickGap={40}
          />
          <YAxis
            unit="M"
            tick={{ fontSize: 10, fill: "var(--fg-muted)" }}
            axisLine={false}
            tickLine={false}
            width={46}
            tickFormatter={(v: number) => (v >= 10 ? String(Math.round(v)) : v.toFixed(1))}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(v) => timeTick(Number(v), rangeHours)}
            formatter={(value: number, name: string) => [
              `${bytes((value as number) * 1024 ** 2)}/s`,
              name === "down" ? t("node.downSpeed") : t("node.upSpeed"),
            ]}
          />
          <Area type="monotone" dataKey="down" stroke="#22c55e" fill="#22c55e" fillOpacity={0.12} strokeWidth={1.6} dot={false} isAnimationActive={false} />
          <Area type="monotone" dataKey="up" stroke={accentColor()} fill={accentColor()} fillOpacity={0.12} strokeWidth={1.6} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
