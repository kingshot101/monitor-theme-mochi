import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Globe2, Wallet } from "lucide-react"
import type { Node } from "@/lib/types"
import { Badge, Input, Modal, Select, cx } from "@/components/ui"
import { cycleLabel, flagEmoji, money } from "@/lib/format"
import { computeValue, mergePrice, urgency } from "./calc"
import { getOverride, KNOWN_CURRENCIES, useRates } from "./store"

/** 剩余价值总览：全节点列表 + 按货币小计 + 手动汇率折算基准货币 */
export function ValueSummary({ open, onClose, nodes }: { open: boolean; onClose: () => void; nodes: Node[] }) {
  const { t, i18n } = useTranslation()
  const { base, setBase, rateOf, setRate } = useRates()

  const rows = useMemo(() => {
    return nodes
      .map((n) => {
        const o = getOverride(n.id)
        const v = computeValue(mergePrice(n, o), o)
        return { n, v, o }
      })
      .filter((r) => r.v.hasPrice || r.v.remainingDays != null)
      .sort((a, b) => {
        const da = a.v.remainingDays ?? Number.MAX_SAFE_INTEGER
        const db = b.v.remainingDays ?? Number.MAX_SAFE_INTEGER
        return da - db
      })
  }, [nodes, open])

  const byCurrency = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rows) {
      if (r.v.remainingValue != null) {
        const cur = (r.v.currency || "?").toUpperCase()
        m.set(cur, (m.get(cur) ?? 0) + r.v.remainingValue)
      }
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [rows])

  let convertedTotal = 0
  let allConverted = byCurrency.length > 0
  for (const [cur, sum] of byCurrency) {
    const rate = rateOf(cur)
    if (rate == null) {
      allConverted = false
    } else {
      convertedTotal += sum * rate
    }
  }

  return (
    <Modal open={open} onClose={onClose} wide>
      <div className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 pr-6">
          <h3 className="flex items-center gap-2 text-base font-bold">
            <Wallet size={17} className="text-primary" /> {t("value.summary")}
          </h3>
          <label className="flex items-center gap-1.5 text-[11px] text-fg-muted">
            {t("value.baseCurrency")}
            <Select
              value={base}
              onChange={setBase}
              options={KNOWN_CURRENCIES.map((c) => ({ value: c, label: c }))}
              className="h-7"
            />
          </label>
        </div>

        {rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-fg-muted">{t("value.summaryEmpty")}</div>
        ) : (
          <>
            {/* 节点列表 */}
            <div className="mb-4 max-h-[46vh] space-y-1.5 overflow-y-auto pr-1">
              {rows.map(({ n, v, o }) => {
                const u = urgency(v.remainingDays)
                return (
                  <div
                    key={n.id}
                    className="flex items-center gap-2.5 rounded-xl border border-line px-3 py-2 text-xs"
                  >
                    <span>{flagEmoji(n.country)}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{n.name}</span>
                    {v.hasPrice ? (
                      <span className="tnum hidden text-fg-muted sm:inline">
                        {money(v.price, v.currency)} · {cycleLabel(v.billing_cycle, i18n.language)}
                      </span>
                    ) : (
                      <Badge>{t("value.noPrice")}</Badge>
                    )}
                    <span
                      className={cx(
                        "tnum w-16 text-right font-semibold",
                        u === "expired" || u === "bad" ? "text-bad" : u === "warn" ? "text-warn" : "text-fg",
                      )}
                    >
                      {v.remainingDays == null
                        ? "—"
                        : v.remainingDays < 0
                          ? t("value.expired")
                          : `${v.remainingDays}${t("value.daysUnit")}`}
                    </span>
                    <span className="tnum w-24 text-right font-bold text-primary">
                      {v.remainingValue != null ? money(v.remainingValue, v.currency) : "—"}
                    </span>
                    {o && <Badge tone="warn">{t("value.localPrice")}</Badge>}
                  </div>
                )
              })}
            </div>

            {/* 按货币小计 + 汇率 */}
            <div className="rounded-xl border border-line bg-card-soft p-3.5">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
                <Globe2 size={13} className="text-primary" /> {t("value.byCurrency")}
              </div>
              <div className="space-y-1.5">
                {byCurrency.map(([cur, sum]) => {
                  const rate = rateOf(cur)
                  return (
                    <div key={cur} className="flex items-center gap-2 text-xs">
                      <span className="w-10 font-semibold">{cur}</span>
                      <span className="tnum flex-1 text-fg-muted">{money(sum, cur)}</span>
                      {cur !== base.toUpperCase() ? (
                        <label className="flex items-center gap-1 text-[10px] text-fg-muted">
                          ×
                          <input
                            className="h-6 w-20 rounded-lg border border-line bg-card px-2 text-right text-[11px] outline-none focus:border-primary tnum"
                            placeholder={t("value.ratePlaceholder")}
                            type="number"
                            step="any"
                            min="0"
                            defaultValue={rate ?? ""}
                            onChange={(e) => {
                              const x = parseFloat(e.target.value)
                              setRate(cur, isFinite(x) ? x : null)
                            }}
                          />
                        </label>
                      ) : (
                        <span className="text-[10px] text-fg-muted">= 1</span>
                      )}
                      <span className="tnum w-28 text-right font-semibold">
                        {rate != null ? money(sum * rate, base) : "—"}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="mt-3 flex items-baseline justify-between border-t border-line pt-2.5">
                <span className="text-xs text-fg-muted">{t("value.convertedTotal", { base })}</span>
                <span className="text-xl font-bold tnum text-primary">
                  {allConverted && byCurrency.length ? money(convertedTotal, base) : "—"}
                </span>
              </div>
              <div className="mt-1 text-right text-[10px] text-fg-muted">{t("value.rateHint")}</div>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
