import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import type { Node } from "@/lib/types"
import { currencySymbol } from "@/lib/format"
import { useApp } from "@/context"
import { getOverride } from "./store"
import { computeValue, mergePrice, urgency, type ValueResult } from "./calc"
import { ValueDialog } from "./ValueDialog"
import { Badge } from "@/components/ui"

/** 到期徽章：剩余天数着色（≤7 红 / ≤30 黄 / 其余绿 / 已过期红） */
export function ExpiryBadge({ node }: { node: Node }) {
  const { t } = useTranslation()
  const v = useMemo(() => computeValue(mergePrice(node, getOverride(node.id))), [node])
  if (v.remainingDays == null) return null
  const u = urgency(v.remainingDays)
  if (u === "expired")
    return <Badge tone="bad">{t("node.expiredDays", { n: -v.remainingDays })}</Badge>
  if (u === "bad")
    return (
      <Badge tone="bad">
        {v.remainingDays === 0 ? t("node.expiringToday") : t("node.expiresInDays", { n: v.remainingDays })}
      </Badge>
    )
  if (u === "warn") return <Badge tone="warn">{t("node.expiresInDays", { n: v.remainingDays })}</Badge>
  return <Badge tone="good">{t("node.expiresInDays", { n: v.remainingDays })}</Badge>
}

export function valueTone(v: ValueResult): "good" | "warn" | "bad" {
  const u = urgency(v.remainingDays)
  return u === "expired" || u === "bad" ? "bad" : u === "warn" ? "warn" : "good"
}

/**
 * 剩余价值小按钮：卡片/表格行上的圆形入口，点击弹悬浮窗。
 * 展示货币符号 + 临期徽标；后台可用 show_value_module 配置整体隐藏。
 */
export function ValueButton({ node }: { node: Node }) {
  const { t } = useTranslation()
  const { showValue } = useApp()
  const [open, setOpen] = useState(false)
  if (!showValue) return null

  const v = computeValue(mergePrice(node, getOverride(node.id)))
  const u = urgency(v.remainingDays)
  const sym = v.hasPrice
    ? currencySymbol(v.currency)
    : "¥"
  const days = v.remainingDays
  const urgent = u === "bad" || u === "expired"

  return (
    <>
      <button
        data-value-btn
        aria-label={t("value.buttonAria")}
        title={t("value.buttonAria")}
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        className={`relative inline-flex h-7 min-w-7 cursor-pointer items-center justify-center gap-0.5 rounded-lg border px-1.5 text-[11px] font-semibold transition-all ${
          v.hasPrice
            ? "border-primary/35 bg-primary-soft text-primary hover:border-primary hover:shadow-sm"
            : "border-line bg-card-soft text-fg-muted hover:border-primary/40 hover:text-primary"
        } ${urgent ? "ring-2 ring-bad/30" : ""}`}
      >
        <span>{sym.trim() || "¥"}</span>
        {days != null && urgent && <span className="tnum">{days < 0 ? -days : days}</span>}
        {!v.hasPrice && <span className="text-[9px]">+</span>}
      </button>
      <ValueDialog node={node} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
