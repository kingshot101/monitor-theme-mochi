import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import type { History, Node, RangeKey } from "@/lib/types"
import { fetchHistory } from "@/lib/api"
import { Badge, Card, Segmented, cx } from "@/components/ui"
import { PingChart } from "./charts"
import { NodeName, ValueButton } from "./parts"

const TASK_LIMIT = 12

/** Task 视图（网络视图）：每节点 ping 延迟小多图 + 丢包徽章 */
export function TaskView({ nodes }: { nodes: Node[] }) {
  const { t } = useTranslation()
  const [range, setRange] = useState<RangeKey>("1h")
  const [width, setWidth] = useState(360)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const list = nodes.slice(0, TASK_LIMIT)

  return (
    <div ref={ref}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs text-fg-muted">
          {list.length === nodes.length ? "" : t("site.nodes") + ` ${TASK_LIMIT}/${nodes.length}`}
        </span>
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
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {list.map((n) => (
          <TaskCard key={n.id} node={n} range={range} width={Math.max(240, width / 2 - 24)} />
        ))}
      </div>
    </div>
  )
}

function TaskCard({ node, range, width }: { node: Node; range: RangeKey; width: number }) {
  const { t } = useTranslation()
  const [history, setHistory] = useState<History | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    let on = true
    setHistory(null)
    setError("")
    const delay = (node.sort % 6) * 120 // 错峰请求
    const timer = setTimeout(() => {
      fetchHistory(node.id, range, "ping", width)
        .then((h) => on && setHistory(h))
        .catch((e) => on && setError(e instanceof Error ? e.message : String(e)))
    }, delay)
    return () => {
      on = false
      clearTimeout(timer)
    }
  }, [node.id, range, width])

  const lossEntries = Object.entries(history?.loss ?? {})
  const probes = Object.values(history?.probes ?? {})

  return (
    <Card className="p-3.5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <NodeName node={node} />
        <div className="flex items-center gap-1.5">
          {lossEntries.length > 0 ? (
            lossEntries.slice(0, 3).map(([id, l]) => (
              <Badge key={id} tone={l >= 10 ? "bad" : l > 0 ? "warn" : "good"} className="tnum">
                {(history?.probes?.[id] ?? id).slice(0, 10)} {l.toFixed(1)}%
              </Badge>
            ))
          ) : probes.length > 0 ? (
            <Badge tone="good">OK</Badge>
          ) : null}
          <ValueButton node={node} />
        </div>
      </div>
      {error ? (
        <div className="flex h-32 items-center justify-center text-xs text-bad">{error}</div>
      ) : history ? (
        <PingChart history={history} rangeHours={range === "1h" ? 1 : range === "6h" ? 6 : range === "24h" ? 24 : 168} height={150} />
      ) : (
        <div className="flex h-[150px] items-center justify-center">
          <div className={cx("h-6 w-6 animate-spin rounded-full border-2 border-line border-t-primary")} />
        </div>
      )}
    </Card>
  )
}
