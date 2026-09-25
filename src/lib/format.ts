const UNITS = ["B", "KB", "MB", "GB", "TB", "PB"]

const unitOf = (n: number) =>
  Math.min(Math.floor(Math.log(n) / Math.log(1024)), UNITS.length - 1)

/** 字节数 → "1.2 GB" */
export function bytes(n: number | null | undefined, digits = 1): string {
  if (n == null || !isFinite(n)) return "—"
  if (n < 1) return "0 B"
  const u = unitOf(n)
  return `${(n / 1024 ** u).toFixed(digits)} ${UNITS[u]}`
}

/** 字节速率 → "12.3 MB/s" */
export function bps(n: number | null | undefined, digits = 1): string {
  if (n == null || !isFinite(n) || n < 0) return "—"
  return `${bytes(n, digits)}/s`
}

/** percent 0-100 → "12.3%"，无效返回 — */
export function pct(n: number | null | undefined, digits = 1): string {
  if (n == null || !isFinite(n)) return "—"
  return `${n.toFixed(digits)}%`
}

/** 秒 → "3天4小时" / "2:03:04" */
export function uptime(sec: number | null | undefined): string {
  if (sec == null || !isFinite(sec) || sec < 0) return "—"
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export const CURRENCY_SYMBOL: Record<string, string> = {
  CNY: "¥",
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  HKD: "HK$",
  TWD: "NT$",
  SGD: "S$",
  KRW: "₩",
  RUB: "₽",
  INR: "₹",
  AUD: "A$",
  CAD: "C$",
}

export function currencySymbol(currency: string): string {
  return CURRENCY_SYMBOL[(currency || "").toUpperCase()] ?? ` ${currency} `
}

/** 金额：货币符号 + 千分位，最多两位小数 */
export function money(n: number | null | undefined, currency = ""): string {
  if (n == null || !isFinite(n)) return "—"
  const abs = Math.abs(n)
  const digits = abs >= 1000 ? 0 : abs >= 100 ? 1 : 2
  const num = n.toLocaleString("en-US", {
    minimumFractionDigits: abs < 100 ? 2 : 0,
    maximumFractionDigits: digits || 2,
  })
  return `${currencySymbol(currency)}${num}`
}

/** monitor hub 的 billing_cycle 取值 → 折算天数（null = 一次性/未识别） */
export const CYCLE_DAYS: Record<string, number> = {
  monthly: 30,
  quarterly: 91,
  semiannual: 182,
  yearly: 365,
  biennial: 730,
  triennial: 1095,
}

/** billing_cycle → 展示名 */
export const CYCLE_LABEL: Record<string, Record<string, string>> = {
  "zh-CN": {
    monthly: "月付",
    quarterly: "季付",
    semiannual: "半年付",
    yearly: "年付",
    biennial: "两年付",
    triennial: "三年付",
    once: "买断",
  },
  en: {
    monthly: "Monthly",
    quarterly: "Quarterly",
    semiannual: "Semiannual",
    yearly: "Yearly",
    biennial: "Biennial",
    triennial: "Triennial",
    once: "Lifetime",
  },
}

export function cycleLabel(cycle: string, lang = "zh-CN"): string {
  const table = CYCLE_LABEL[lang] ?? CYCLE_LABEL.en
  return table[cycle] ?? (cycle || "—")
}

/** ISO 时间或 Date → 本地 "2026-09-24" */
export function dateStr(iso: string | number | Date | null | undefined): string {
  if (iso == null || iso === "") return "—"
  const d = iso instanceof Date ? iso : new Date(iso)
  if (isNaN(d.getTime())) return "—"
  const p = (x: number) => String(x).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function dateTimeStr(iso: string | number | Date | null | undefined): string {
  if (iso == null || iso === "") return "—"
  const d = iso instanceof Date ? iso : new Date(iso)
  if (isNaN(d.getTime())) return "—"
  const p = (x: number) => String(x).padStart(2, "0")
  return `${dateStr(d)} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** ISO alpha-2 → emoji 国旗 */
export function flagEmoji(cc: string | undefined | null): string {
  if (!cc || cc.length !== 2) return "🌐"
  const base = 0x1f1e6
  const up = cc.toUpperCase()
  return String.fromCodePoint(base + up.charCodeAt(0) - 65, base + up.charCodeAt(1) - 65)
}

/** os 字符串 → 系统 emoji（注意先判 darwin：字符串里含 "win" 子串） */
export function osEmoji(os: string | undefined): string {
  const s = (os || "").toLowerCase()
  if (s.includes("darwin") || s.includes("mac") || s.includes("ios")) return "🍎"
  if (s.includes("win")) return "🪟"
  if (s.includes("android")) return "🤖"
  return "🐧"
}

/** os 字符串 → 内置系统 Logo（public/assets/os/<key>.svg），匹配不到返回 null 回退 emoji */
const OS_RULES: [RegExp, string][] = [
  // 具体发行版在前，泛称在后；darwin/macos 必须先于 windows
  [/almalinux|alma/i, "almalinux"],
  [/rocky/i, "rocky"],
  [/centos/i, "centos"],
  [/ubuntu/i, "ubuntu"],
  [/kali/i, "kali"],
  [/raspbian|raspberry/i, "raspbian"],
  [/red\s*hat|redhat|rhel/i, "rhel"],
  [/fedora/i, "fedora"],
  [/gentoo/i, "gentoo"],
  [/nixos/i, "nixos"],
  [/openwrt/i, "openwrt"],
  [/deepin|\buos\b/i, "linux"],
  [/opensuse|suse/i, "opensuse"],
  [/oracle/i, "oracle"],
  [/proxmox|\bpve\b/i, "proxmox"],
  [/arch/i, "arch"],
  [/alpine/i, "alpine"],
  [/freebsd/i, "freebsd"],
  [/docker/i, "docker"],
  [/darwin|mac\s?os|macos|apple|ios/i, "macos"],
  [/windows|win\s?1[01]|win32|win64/i, "windows"],
  [/linux|gnu/i, "linux"],
]

export function osIcon(os: string | undefined): string | null {
  const s = os || ""
  for (const [re, key] of OS_RULES) if (re.test(s)) return key
  return null
}
