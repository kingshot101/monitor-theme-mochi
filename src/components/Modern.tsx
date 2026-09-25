import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import type { Node } from "@/lib/types"
import { bytes, dateTimeStr, uptime } from "@/lib/format"
import { Badge, Card, Ring } from "@/components/ui"
import { ExpiryBadge, MetricBar, NetRow, NodeName, PriceTag, TrafficHint, UptimeHint, ValueButton } from "./parts"
import { periodTraffic } from "@/value/calc"

/** Modern 视图：圆环仪表卡片网格（mochi 现代卡片观的还原） */
export function ModernView({ nodes }: { nodes: Node[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {nodes.map((n) => (
        <ModernCard key={n.id} node={n} />
      ))}
    </div>
  )
}

function ModernCard({ node }: { node: Node }) {
  const { t } = useTranslation()
  const nav = useNavigate()
  const m = node.metrics
  const cpu = m?.cpu ?? null
  const memP = m ? (m.mem_used / (m.mem_total || 1)) * 100 : null
  const diskP = m ? (m.disk_used / (m.disk_total || 1)) * 100 : null
  const traffic = periodTraffic(node)
  const trafficP = traffic != null && node.traffic_limit > 0 ? (traffic / node.traffic_limit) * 100 : null

  return (
    <Card hover onClick={() => nav(`/instance/${node.id}`)} className="p-4">
      {/* 头部 */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <NodeName node={node} />
        <div className="flex shrink-0 items-center gap-1">
          <PriceTag node={node} />
          <ValueButton node={node} />
        </div>
      </div>

      {/* 圆环区 */}
      {m ? (
        <div className="grid grid-cols-4 gap-1 py-1.5">
          <Ring value={cpu ?? 0} label={t("node.cpu")} />
          <Ring value={memP ?? 0} label={t("node.mem")} />
          <Ring value={diskP ?? 0} label={t("node.disk")} />
          {trafficP != null ? (
            <Ring value={trafficP} label={t("node.traffic")} />
          ) : (
            <div className="flex flex-col items-center justify-center gap-1">
              <div className="tnum text-sm font-bold">{uptime(m.uptime)}</div>
              <div className="text-[10px] text-fg-muted">{t("node.uptime")}</div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex h-[86px] items-center justify-center rounded-xl bg-card-soft text-xs text-fg-muted">
          {node.online ? t("site.unavailable") : t("site.offline")}
        </div>
      )}

      {/* 底部信息 */}
      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-line pt-2.5">
        <NetRow node={node} />
        <div className="flex items-center gap-1.5">
          <TrafficHint node={node} />
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] text-fg-muted tnum">
          {m ? (
            <span>TCP {m.tcp} · UDP {m.udp}</span>
          ) : (
            <span>
              {t("node.lastSeen")} {dateTimeStr(node.last_seen)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <ExpiryBadge node={node} />
        </div>
      </div>
      {node.group ? (
        <div className="mt-2">
          <Badge>{node.group}</Badge>
        </div>
      ) : null}
      {/* 内存/磁盘数字补充 */}
      {m && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <MetricBar label={t("node.mem")} used={m.mem_used} total={m.mem_total} />
          <MetricBar label={t("node.disk")} used={m.disk_used} total={m.disk_total} />
        </div>
      )}
    </Card>
  )
}

/** Compact 视图：高密度小卡（mochi 紧凑视图还原） */
export function CompactView({ nodes }: { nodes: Node[] }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {nodes.map((n) => (
        <CompactCard key={n.id} node={n} />
      ))}
    </div>
  )
}

function CompactCard({ node }: { node: Node }) {
  const nav = useNavigate()
  const m = node.metrics
  return (
    <Card hover onClick={() => nav(`/instance/${node.id}`)} className="p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <NodeName node={node} />
        <div className="flex shrink-0 items-center gap-1">
          <PriceTag node={node} />
          <ValueButton node={node} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <MetricBar label="CPU" used={m?.cpu ?? null} total={100} format="percent" />
        <MetricBar label="MEM" used={m?.mem_used} total={m?.mem_total} digits={0} />
        <MetricBar label="DISK" used={m?.disk_used} total={m?.disk_total} digits={0} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-2">
        <NetRow node={node} />
        <div className="flex items-center gap-2">
          <TrafficHint node={node} />
          <ExpiryBadge node={node} />
        </div>
      </div>
    </Card>
  )
}
