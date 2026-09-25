import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Database, Info, Pencil, Trash2 } from "lucide-react"
import type { Node } from "@/lib/types"
import { Badge, Button, Input, Modal, Progress, Select, cx } from "@/components/ui"
import { bytes, cycleLabel, dateStr, flagEmoji, money } from "@/lib/format"
import { allocation, computeValue, mergePrice, periodTraffic, urgency } from "./calc"
import type { Override } from "./calc"
import { getOverride, KNOWN_CURRENCIES, setOverride } from "./store"

export function ValueDialog({
  node,
  open,
  onClose,
}: {
  node: Node
  open: boolean
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const override = useMemo(() => getOverride(node.id), [node.id, open])
  const src = useMemo(() => mergePrice(node, override), [node, override])
  const v = useMemo(() => computeValue(src, override), [src, override])
  const allo = allocation(v, node)
  const traffic = periodTraffic(node)
  const limit = node.traffic_limit > 0 ? node.traffic_limit : null

  const [editing, setEditing] = useState(false)
  const [price, setPrice] = useState("")
  const [currency, setCurrency] = useState("CNY")
  const [cycle, setCycle] = useState("monthly")
  const [purchased, setPurchased] = useState("")
  const [expiry, setExpiry] = useState("")

  useEffect(() => {
    if (!open) return
    const o = getOverride(node.id)
    setPrice(o?.price != null ? String(o.price) : node.price > 0 ? String(node.price) : "")
    setCurrency(o?.currency || node.currency || "CNY")
    setCycle(o?.billing_cycle || node.billing_cycle || "monthly")
    setPurchased(o?.purchased_at ?? "")
    setExpiry((o?.expires_at ?? node.expires_at ?? "").slice(0, 10))
    setEditing(!v.hasPrice)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, node.id])

  const saveOverride = () => {
    const o: Override = {}
    const p = parseFloat(price)
    if (isFinite(p) && p > 0) o.price = p
    if (currency) o.currency = currency
    if (cycle) o.billing_cycle = cycle
    if (purchased) o.purchased_at = purchased
    if (expiry) o.expires_at = new Date(expiry + "T23:59:59").toISOString()
    setOverride(node.id, Object.keys(o).length ? o : null)
    setEditing(false)
  }

  const u = urgency(v.remainingDays)
  const currencyOptions = [
    ...new Set([...KNOWN_CURRENCIES, (node.currency || "").toUpperCase()].filter(Boolean)),
  ].map((c) => ({ value: c, label: c }))

  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-5">
        {/* 头部 */}
        <div className="mb-4 flex flex-wrap items-center gap-2 pr-6">
          <span className="text-lg">{flagEmoji(node.country)}</span>
          <h3 className="text-base font-bold">{node.name}</h3>
          {node.group ? <Badge>{node.group}</Badge> : null}
          <Badge tone="primary">{t("value.module")}</Badge>
          {v.fromLocal && <Badge tone="warn">{t("value.localPrice")}</Badge>}
        </div>

        {/* 到期 + 剩余天数 */}
        <div className="mb-3 rounded-xl border border-line bg-card-soft p-3.5">
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-xs text-fg-muted">{t("value.expiry")}</div>
            <div className="tnum text-sm font-semibold">{dateStr(v.expiryAt) !== "—" ? dateStr(v.expiryAt) : t("value.noExpiry")}</div>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <div className="text-xs text-fg-muted">{t("value.remainingDays")}</div>
            {v.remainingDays == null ? (
              <div className="text-sm text-fg-muted">{t("value.noExpiry")}</div>
            ) : v.remainingDays < 0 ? (
              <div className="tnum text-sm font-bold text-bad">
                {t("value.expiredDays", { n: -v.remainingDays })}
              </div>
            ) : (
              <div className={cx("tnum text-sm font-bold", u === "bad" && "text-bad", u === "warn" && "text-warn")}>
                {v.remainingDays} {t("value.daysUnit")}
              </div>
            )}
          </div>
          {v.ratio != null && (
            <div className="mt-2.5">
              <Progress value={v.ratio * 100} tone={u === "expired" || u === "bad" ? "bad" : u === "warn" ? "warn" : "good"} />
              <div className="mt-1 text-right text-[10px] text-fg-muted tnum">
                {t("value.ratio")} {(v.ratio * 100).toFixed(1)}%
              </div>
            </div>
          )}
        </div>

        {/* 价值主卡 */}
        {v.hasPrice ? (
          v.isOnce ? (
            <div className="mb-3 rounded-xl border border-primary/25 bg-primary-soft/60 p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                <Info size={13} /> {t("value.lifetime")}
              </div>
              <div className="mt-1.5 text-2xl font-bold tnum">
                {money(v.remainingValue ?? v.price, v.currency)}
              </div>
              <div className="mt-0.5 text-[11px] text-fg-muted">{t("value.lifetimeHint")}</div>
            </div>
          ) : (
            <div className="mb-3 rounded-xl border border-primary/25 bg-primary-soft/60 p-3.5">
              <div className="text-xs text-fg-muted">{t("value.remainingValue")}</div>
              <div className="mt-0.5 flex items-baseline gap-2">
                <span className="text-3xl font-bold tnum text-primary">
                  {money(v.remainingValue, v.currency)}
                </span>
                <span className="text-xs text-fg-muted tnum">/ {money(v.price, v.currency)}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge>
                  {t("value.usedValue")} {money(v.usedValue, v.currency)}
                </Badge>
                <Badge>
                  {t("value.price")} {money(v.price, v.currency)} · {cycleLabel(v.billing_cycle, i18n.language)}
                </Badge>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <MiniStat label={t("value.daily")} value={money(v.daily, v.currency)} />
                <MiniStat label={t("value.monthly")} value={money(v.monthly, v.currency)} />
                <MiniStat label={t("value.yearly")} value={money(v.yearly, v.currency)} />
              </div>
            </div>
          )
        ) : (
          <div className="mb-3 rounded-xl border border-dashed border-line p-3.5 text-xs text-fg-muted">
            <div className="font-semibold text-fg">{t("value.noPrice")}</div>
            <div className="mt-1 leading-5">{t("value.noPriceHint")}</div>
          </div>
        )}

        {/* 成本分摊 */}
        {v.hasPrice && !v.isOnce && (allo.cores || allo.memGB || allo.diskGB) && (
          <div className="mb-3 rounded-xl border border-line p-3.5">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
              <Database size={13} className="text-primary" /> {t("value.allocation")}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <MiniStat label={t("value.perCore")} value={allo.cores ? money(allo.cores, v.currency) : "—"} />
              <MiniStat label={t("value.perGBMem")} value={allo.memGB ? money(allo.memGB, v.currency) : "—"} />
              <MiniStat label={t("value.perGBDisk")} value={allo.diskGB ? money(allo.diskGB, v.currency) : "—"} />
            </div>
          </div>
        )}

        {/* 本期流量 */}
        {traffic != null && (
          <div className="mb-3 rounded-xl border border-line p-3.5">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-fg-muted">{t("value.trafficOfPeriod")}</span>
              <span className="tnum font-semibold">
                {limit
                  ? t("value.trafficOf", { used: bytes(traffic), limit: bytes(limit) })
                  : `${bytes(traffic)} · ${t("value.noLimit")}`}
              </span>
            </div>
            {limit && (
              <div className="mt-2">
                <Progress value={(traffic / limit) * 100} />
              </div>
            )}
          </div>
        )}

        {/* 本地补录 */}
        <div className="rounded-xl border border-line">
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Pencil size={13} className="text-primary" /> {t("value.localEntry")}
            </div>
            <div className="flex items-center gap-2">
              {(override || node.price > 0) && !editing && (
                <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                  <Pencil size={12} /> {t("value.localEntry")}
                </Button>
              )}
              {override && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setOverride(node.id, null)
                    setEditing(false)
                  }}
                >
                  <Trash2 size={12} /> {t("value.localClear")}
                </Button>
              )}
            </div>
          </div>
          {editing && (
            <div className="border-t border-line p-3">
              <div className="grid grid-cols-2 gap-2">
                <Field label={t("value.priceLabel")}>
                  <Input value={price} onChange={setPrice} placeholder="19.9" type="number" min="0" step="0.01" />
                </Field>
                <Field label={t("value.currencyLabel")}>
                  <Select value={currency} onChange={setCurrency} options={currencyOptions} className="w-full" />
                </Field>
                <Field label={t("value.cycleLabel")}>
                  <Select
                    value={cycle}
                    onChange={setCycle}
                    options={[
                      { value: "monthly", label: cycleLabel("monthly", i18n.language) },
                      { value: "quarterly", label: cycleLabel("quarterly", i18n.language) },
                      { value: "semiannual", label: cycleLabel("semiannual", i18n.language) },
                      { value: "yearly", label: cycleLabel("yearly", i18n.language) },
                      { value: "biennial", label: cycleLabel("biennial", i18n.language) },
                      { value: "triennial", label: cycleLabel("triennial", i18n.language) },
                      { value: "once", label: cycleLabel("once", i18n.language) },
                    ]}
                    className="w-full"
                  />
                </Field>
                <Field label={t("value.expiryLabel")}>
                  <Input value={expiry} onChange={setExpiry} type="date" />
                </Field>
                <div className="col-span-2">
                  <Field label={t("value.purchasedLabel")}>
                    <Input value={purchased} onChange={setPurchased} type="date" />
                  </Field>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="flex items-center gap-1 text-[10px] text-fg-muted">
                  <Info size={11} /> {t("value.localNote")}
                </span>
                <Button size="sm" variant="primary" onClick={saveOverride}>
                  {t("value.localSave")}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* 底部：价格来源 */}
        <div className="mt-3 flex items-center justify-between text-[10px] text-fg-muted">
          <span>
            {override
              ? t("value.localPrice")
              : node.price > 0
                ? `${t("value.hubPrice")} · ${money(node.price, node.currency)}`
                : t("value.noPrice")}
          </span>
          <span className="tnum">{v.hasPrice && v.daily != null ? `${t("value.daily")} ${money(v.daily, v.currency)}` : ""}</span>
        </div>
      </div>
    </Modal>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-card-soft px-2 py-1.5">
      <div className="text-[10px] text-fg-muted">{label}</div>
      <div className="tnum text-xs font-semibold">{value}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] text-fg-muted">{label}</span>
      {children}
    </label>
  )
}
