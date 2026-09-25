import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Languages, Moon, Search, Sun } from "lucide-react"
import { speedHistory, useNodes } from "@/lib/api"
import { bps } from "@/lib/format"
import { inGroup, useApp, type SortKey } from "@/context"
import { Badge, Button, Segmented, Select, Sparkline, StatusDot, cx } from "@/components/ui"

export function StatusBar() {
  const { t } = useTranslation()
  const { me, search, setSearch, sort, setSort, mode, setMode, lang, toggleLang, group } = useApp()
  const { nodes, live } = useNodes()

  // 汇总数字跟随当前分组（搜索不影响汇总）
  const list = useMemo(() => (nodes ?? []).filter((n) => inGroup(n, group)), [nodes, group])
  const online = list.filter((n) => n.online)
  const sumRx = online.reduce((s, n) => s + (n.metrics?.net_rx ?? 0), 0)
  const sumTx = online.reduce((s, n) => s + (n.metrics?.net_tx ?? 0), 0)

  const speedKey = group === "__all__" ? null : group === "__none__" ? "" : group
  const hist = useMemo(() => speedHistory(speedKey), [nodes, speedKey])
  const rxSeries = hist.map((p) => p.rx)
  const txSeries = hist.map((p) => p.tx)

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        {/* 站名 + 状态 */}
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-lg">
            🍡
          </div>
          <div className="min-w-0">
            <div className="truncate text-[15px] leading-5 font-bold">
              {me?.site_name || "Mochi"}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] leading-4 text-fg-muted">
              <StatusDot online={live} size={6} />
              <span className="tnum">
                {online.length}/{list.length} {t("site.online")}
              </span>
              <span className="tnum hidden items-center gap-1 sm:inline-flex">
                ↓ <span className="text-good tnum">{bps(sumRx)}</span>
                <Sparkline data={rxSeries} width={56} height={14} color="var(--good)" />
                ↑ <span className="text-primary tnum">{bps(sumTx)}</span>
                <Sparkline data={txSeries} width={56} height={14} />
              </span>
            </div>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* 搜索 */}
          <label className="relative">
            <Search size={13} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-fg-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("site.search")}
              className="h-9 w-36 rounded-xl border border-line bg-card pr-2 pl-7.5 text-xs outline-none transition-all placeholder:text-fg-muted/60 focus:w-48 focus:border-primary"
            />
          </label>

          <Select
            title={t("site.sort")}
            value={sort}
            onChange={(v) => setSort(v as SortKey)}
            options={[
              { value: "default", label: t("site.sortDefault") },
              { value: "name", label: t("site.sortName") },
              { value: "cpu", label: t("site.sortCpu") },
              { value: "mem", label: t("site.sortMem") },
              { value: "disk", label: t("site.sortDisk") },
              { value: "traffic", label: t("site.sortTraffic") },
              { value: "expiry", label: t("site.sortExpiry") },
            ]}
          />

          <Button
            size="icon"
            variant="ghost"
            title={t("menu.theme")}
            onClick={() => setMode(mode === "dark" ? "light" : "dark")}
          >
            {mode === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </Button>
          <Button size="icon" variant="ghost" title={t("menu.lang")} onClick={toggleLang}>
            <span className="flex items-center text-[11px] font-bold">
              {lang === "zh-CN" ? <Languages size={16} /> : "中"}
            </span>
          </Button>
        </div>
      </div>
    </header>
  )
}

/** 分组 tabs：分组可能很多，横向滚动 */
export function GroupTabs() {
  const { t } = useTranslation()
  const { nodes } = useNodes()
  const { group, setGroup } = useApp()
  const list = nodes ?? []

  const groups = useMemo(() => {
    // 分组按节点顺序排（hub 语义），不按字母序
    const m = new Map<string, number>()
    for (const n of list) {
      const g = n.group ?? ""
      m.set(g, (m.get(g) ?? 0) + 1)
    }
    return [...m.entries()].map(([name, count]) => ({ name, count }))
  }, [list])

  if (groups.length <= 1) return null

  return (
    <div className="no-scrollbar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
      <Pill active={group === "__all__"} onClick={() => setGroup("__all__")}>
        {t("site.all")}
        <span className="tnum opacity-60">{list.length}</span>
      </Pill>
      {groups.map(({ name, count }) => (
        <Pill key={name || "__none__"} active={group === (name || "__none__")} onClick={() => setGroup(name || "__none__")}>
          {name || t("site.ungrouped")}
          <span className="tnum opacity-60">{count}</span>
        </Pill>
      ))}
    </div>
  )
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all",
        active
          ? "border-primary bg-primary text-on-primary shadow-sm"
          : "border-line bg-card text-fg-muted hover:border-primary/40 hover:text-fg",
      )}
    >
      {children}
    </button>
  )
}

/** 视图切换器（六种视图） */
export function ViewModeSelector() {
  const { t } = useTranslation()
  const { view, setView } = useApp()
  return (
    <Segmented
      value={view}
      onChange={setView}
      options={[
        { value: "modern", label: t("view.modern") },
        { value: "compact", label: t("view.compact") },
        { value: "classic", label: t("view.classic") },
        { value: "detailed", label: t("view.detailed") },
        { value: "task", label: t("view.task") },
        { value: "earth", label: t("view.earth") },
      ]}
    />
  )
}

/** 视图标题条 */
export function ViewHeader({ children }: { children?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      {children}
    </div>
  )
}

export function LiveBadge() {
  const { t } = useTranslation()
  const { live } = useNodes()
  return (
    <Badge tone={live ? "good" : "warn"}>
      <StatusDot online={live} size={5} />
      {live ? t("site.live") : t("site.paused")}
    </Badge>
  )
}
