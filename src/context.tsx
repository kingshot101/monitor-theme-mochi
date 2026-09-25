import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { fetchMe, useNodes } from "@/lib/api"
import { loadConfig } from "@/lib/config"
import { loadLS, saveLS } from "@/lib/prefs"
import { initLang, setLang as applySetLang, type Lang } from "@/i18n"
import { setDefaultCurrency } from "@/value/calc"
import type { Me, ThemeConfig } from "@/lib/types"
import type { Node } from "@/lib/types"

export type ViewKey = "modern" | "compact" | "classic" | "detailed" | "task" | "earth"
export type SortKey = "default" | "name" | "cpu" | "mem" | "disk" | "traffic" | "expiry"
export type ModeKey = "light" | "dark" | "system"

type AppCtx = {
  me: Me | null
  config: ThemeConfig
  view: ViewKey
  setView: (v: ViewKey) => void
  sort: SortKey
  setSort: (s: SortKey) => void
  group: string
  setGroup: (g: string) => void
  search: string
  setSearch: (s: string) => void
  mode: ModeKey
  setMode: (m: ModeKey) => void
  lang: Lang
  toggleLang: () => void
  showValue: boolean
  cfgStr: (key: string, fallback: string) => string
  cfgBool: (key: string, fallback: boolean) => boolean
}

const Ctx = createContext<AppCtx | null>(null)

/** 分组过滤：__all__ 全部 / __none__ 未分组 / 其他为分组名（分组可能很多） */
export function inGroup(n: Node, group: string): boolean {
  if (group === "__all__") return true
  const g = n.group ?? ""
  return group === "__none__" ? g === "" : g === group
}

function applyMode(mode: ModeKey) {
  const dark =
    mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches)
  document.documentElement.classList.toggle("dark", dark)
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [config, setConfig] = useState<ThemeConfig>({})
  const [view, setViewState] = useState<ViewKey>(() =>
    (loadLS<string>("view", "") || "modern") as ViewKey,
  )
  const [sort, setSortState] = useState<SortKey>(() => loadLS<SortKey>("sort", "default"))
  const [group, setGroupState] = useState<string>(() => loadLS<string>("group", "__all__"))
  const [search, setSearch] = useState("")
  const [mode, setModeState] = useState<ModeKey>(() =>
    (loadLS<string>("theme", "system") || "system") as ModeKey,
  )
  const [lang, setLangState] = useState<Lang>(() => initLang())

  // 站点名/公开开关 与 主题配置并行加载，互不阻塞
  useEffect(() => {
    fetchMe()
      .then((m) => {
        setMe(m)
        document.title = m.site_name || document.title
      })
      .catch(() => setMe({ authed: false, github: false, site_name: "Mochi", public_page: true }))
    loadConfig()
      .then(setConfig)
      .catch(() => {
        /* 按 manifest 默认值渲染 */
      })
  }, [])

  // 默认货币注入剩余价值计算
  useEffect(() => {
    setDefaultCurrency((config.default_currency as string) || "CNY")
  }, [config])

  // 站点默认语言（访客手动切换过的除外）
  useEffect(() => {
    const dl = config.default_lang as Lang | undefined
    if (!dl) return
    const saved = loadLS<string>("lang", "")
    if (!saved && dl !== lang) {
      setLangState(dl)
      applySetLang(dl)
    }
  }, [config])

  // 主题配置里的默认值（访客本地偏好优先）
  useEffect(() => {
    if (loadLS<string>("view", "")) return
    const dv = config.default_view as ViewKey | undefined
    if (dv) setViewState(dv)
  }, [config])
  useEffect(() => {
    if (loadLS<string>("theme", "")) return
    const tm = (config.theme_mode as ModeKey | undefined) ?? "system"
    setModeState(tm)
  }, [config])
  useEffect(() => {
    const accent = (config.accent as string) || "gold"
    document.documentElement.dataset.accent = accent
  }, [config])

  // 后台自定义网站图标（ICON）：替换 index.html 里的默认 favicon
  useEffect(() => {
    const icon = ((config.icon_url as string) || "").trim()
    if (!icon) return
    for (const rel of ["icon", "apple-touch-icon"]) {
      const link =
        document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`) ??
        document.head.appendChild(Object.assign(document.createElement("link"), { rel }))
      link.href = icon
    }
  }, [config])

  useEffect(() => {
    applyMode(mode)
    const mq = matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => mode === "system" && applyMode(mode)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [mode])

  const setView = useCallback((v: ViewKey) => {
    setViewState(v)
    saveLS("view", v)
  }, [])
  const setSort = useCallback((s: SortKey) => {
    setSortState(s)
    saveLS("sort", s)
  }, [])
  const setGroup = useCallback((g: string) => {
    setGroupState(g)
    saveLS("group", g)
  }, [])
  const setMode = useCallback((m: ModeKey) => {
    setModeState(m)
    saveLS("theme", m)
  }, [])
  const toggleLang = useCallback(() => {
    const next: Lang = lang === "zh-CN" ? "en" : "zh-CN"
    setLangState(next)
    applySetLang(next)
  }, [lang])

  // 后台关闭公开页且未登录 → 回管理页（主题契约要求）
  const { everLoaded } = useNodes()
  useEffect(() => {
    if (me && !me.public_page && !me.authed && everLoaded) {
      location.href = "/admin/"
    }
  }, [me, everLoaded])

  const value = useMemo<AppCtx>(
    () => ({
      me,
      config,
      view,
      setView,
      sort,
      setSort,
      group,
      setGroup,
      search,
      setSearch,
      mode,
      setMode,
      lang,
      toggleLang,
      showValue: (config.show_value_module as boolean | undefined) ?? true,
      cfgStr: (key, fallback) => {
        const v = config[key]
        return typeof v === "string" && v !== "" ? v : fallback
      },
      cfgBool: (key, fallback) => {
        const v = config[key]
        return typeof v === "boolean" ? v : fallback
      },
    }),
    [me, config, view, sort, group, search, mode, lang, setView, setSort, setGroup, setMode, toggleLang],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useApp must be used within AppProvider")
  return ctx
}

/* --------------------------------- 过滤排序 -------------------------------- */

export function filterNodes(
  nodes: Node[],
  group: string,
  search: string,
  sort: SortKey,
): { main: Node[]; offline: Node[] } {
  const q = search.trim().toLowerCase()
  const match = (n: Node) =>
    !q ||
    n.name.toLowerCase().includes(q) ||
    (n.group ?? "").toLowerCase().includes(q) ||
    n.os.toLowerCase().includes(q) ||
    n.country.toLowerCase().includes(q)

  const list = nodes.filter((n) => inGroup(n, group) && match(n))
  const byName = (a: Node, b: Node) => a.name.localeCompare(b.name)
  const sorted = [...list]
  if (sort === "name") sorted.sort(byName)
  else if (sort === "cpu" || sort === "mem" || sort === "disk") {
    const pick = (n: Node) =>
      n.metrics ? (sort === "cpu" ? n.metrics.cpu : sort === "mem"
        ? (n.metrics.mem_used / (n.metrics.mem_total || 1)) * 100
        : (n.metrics.disk_used / (n.metrics.disk_total || 1)) * 100) : -1
    sorted.sort((a, b) => pick(b) - pick(a))
  } else if (sort === "traffic") {
    const pick = (n: Node) => (n.month_used ?? (n.month_rx ?? 0) + (n.month_tx ?? 0))
    sorted.sort((a, b) => pick(b) - pick(a))
  } else if (sort === "expiry") {
    const pick = (n: Node) =>
      n.expires_in == null ? Number.MAX_SAFE_INTEGER : n.expires_in
    sorted.sort((a, b) => pick(a) - pick(b))
  } else {
    sorted.sort((a, b) => a.sort - b.sort || byName(a, b))
  }
  return {
    main: sorted.filter((n) => n.online),
    offline: sorted.filter((n) => !n.online),
  }
}

export function groupsOf(nodes: Node[]): { name: string; count: number }[] {
  const m = new Map<string, number>()
  for (const n of nodes) {
    const g = n.group ?? ""
    m.set(g, (m.get(g) ?? 0) + 1)
  }
  return [...m.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => (a.name === "" ? 1 : b.name === "" ? -1 : a.name.localeCompare(b.name)))
}
