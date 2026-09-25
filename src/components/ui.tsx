import { type CSSProperties, type ReactNode, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ")
}

/** 读当前生效的 CSS 变量（强调色切换后图表/地球同步用） */
export function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

/* ---------------------------------- Card ---------------------------------- */

export function Card({
  children,
  className,
  hover,
  onClick,
}: {
  children: ReactNode
  className?: string
  hover?: boolean
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={cx(
        "rounded-2xl border border-line bg-card shadow-sm backdrop-blur-md",
        hover && "card-hover cursor-pointer",
        className,
      )}
    >
      {children}
    </div>
  )
}

/* ---------------------------------- Badge --------------------------------- */

export function Badge({
  children,
  tone = "default",
  className,
}: {
  children: ReactNode
  tone?: "default" | "good" | "warn" | "bad" | "primary"
  className?: string
}) {
  const tones: Record<string, string> = {
    default: "bg-card-soft text-fg-muted border-line",
    good: "bg-good/10 text-good border-good/30",
    warn: "bg-warn/10 text-warn border-warn/30",
    bad: "bg-bad/10 text-bad border-bad/30",
    primary: "bg-primary-soft text-primary border-primary/30",
  }
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] leading-4 font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/* --------------------------------- Button --------------------------------- */

export function Button({
  children,
  onClick,
  variant = "ghost",
  size = "md",
  className,
  title,
  type,
  disabled,
}: {
  children: ReactNode
  onClick?: (e: React.MouseEvent) => void
  variant?: "primary" | "soft" | "ghost" | "outline"
  size?: "sm" | "md" | "icon"
  className?: string
  title?: string
  type?: "button" | "submit"
  disabled?: boolean
}) {
  const variants: Record<string, string> = {
    primary: "bg-primary text-on-primary hover:bg-primary-strong",
    soft: "bg-primary-soft text-primary hover:bg-primary/15",
    ghost: "text-fg-muted hover:bg-card-soft hover:text-fg",
    outline: "border border-line text-fg hover:border-primary/50 hover:text-primary",
  }
  const sizes: Record<string, string> = {
    sm: "h-7 px-2.5 text-xs rounded-lg",
    md: "h-9 px-3.5 text-sm rounded-xl",
    icon: "h-9 w-9 rounded-xl",
  }
  return (
    <button
      type={type ?? "button"}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "inline-flex cursor-pointer items-center justify-center gap-1.5 font-medium transition-colors select-none disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {children}
    </button>
  )
}

/* -------------------------------- Progress -------------------------------- */

export function Progress({
  value,
  tone,
  className,
  trackClass,
}: {
  value: number
  tone?: "good" | "warn" | "bad" | "primary"
  className?: string
  trackClass?: string
}) {
  const v = Math.max(0, Math.min(100, value))
  const auto = v >= 90 ? "bad" : v >= 75 ? "warn" : "good"
  const t = tone ?? auto
  const colors: Record<string, string> = {
    good: "bg-good",
    warn: "bg-warn",
    bad: "bg-bad",
    primary: "bg-primary",
  }
  return (
    <div className={cx("h-1.5 w-full overflow-hidden rounded-full bg-card-soft", trackClass)}>
      <div
        className={cx("h-full rounded-full transition-[width] duration-500", colors[t])}
        style={{ width: `${v}%` }}
      />
    </div>
  )
}

/* --------------------------- Ring（Modern 圆环仪表） --------------------------- */

export function Ring({
  value,
  label,
  sub,
  size = 64,
  tone,
}: {
  value: number
  label: string
  sub?: string
  size?: number
  tone?: "good" | "warn" | "bad" | "primary"
}) {
  const v = Math.max(0, Math.min(100, isFinite(value) ? value : 0))
  const t = tone ?? (v >= 90 ? "bad" : v >= 75 ? "warn" : "primary")
  const colors: Record<string, string> = {
    good: "var(--good)",
    warn: "var(--warn)",
    bad: "var(--bad)",
    primary: "var(--primary)",
  }
  const r = (size - 8) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--card-soft)"
            strokeWidth={5}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={colors[t]}
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - v / 100)}
            className="transition-[stroke-dashoffset] duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="tnum text-[11px] font-semibold">{v.toFixed(0)}%</span>
        </div>
      </div>
      <div className="text-[10px] text-fg-muted">{label}</div>
      {sub && <div className="text-[10px] text-fg-muted/80 tnum">{sub}</div>}
    </div>
  )
}

/* ---------------------------------- Modal --------------------------------- */

export function Modal({
  open,
  onClose,
  children,
  wide,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div
      className="animate-fade fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        className={cx(
          "animate-pop relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-line bg-card shadow-2xl backdrop-blur-xl sm:rounded-2xl",
          wide ? "sm:max-w-2xl" : "sm:max-w-md",
        )}
      >
        <button
          onClick={onClose}
          aria-label="close"
          className="absolute top-3 right-3 z-10 rounded-lg p-1.5 text-fg-muted transition-colors hover:bg-card-soft hover:text-fg"
        >
          <X size={16} />
        </button>
        {children}
      </div>
    </div>,
    document.body,
  )
}

/* -------------------------------- Segmented -------------------------------- */

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T
  options: { value: T; label: ReactNode; title?: string }[]
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={cx("flex items-center gap-0.5 rounded-xl border border-line bg-card p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cx(
            "flex cursor-pointer items-center gap-1 rounded-[10px] px-2.5 py-1.5 text-xs font-medium transition-all",
            value === o.value
              ? "bg-primary text-on-primary shadow-sm"
              : "text-fg-muted hover:bg-card-soft hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* --------------------------------- Select --------------------------------- */

export function Select({
  value,
  options,
  onChange,
  className,
  title,
}: {
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  className?: string
  title?: string
}) {
  return (
    <select
      title={title}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cx(
        "h-9 cursor-pointer rounded-xl border border-line bg-card px-2.5 text-xs font-medium text-fg outline-none transition-colors hover:border-primary/50 focus:border-primary",
        className,
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

/* --------------------------------- Switch --------------------------------- */

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex cursor-pointer items-center gap-2 text-xs text-fg"
    >
      <span
        className={cx(
          "relative h-5 w-9 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-line",
        )}
      >
        <span
          className={cx(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
            checked ? "left-4.5" : "left-0.5",
          )}
        />
      </span>
      {label}
    </button>
  )
}

/* --------------------------------- Input ---------------------------------- */

export function Input({
  value,
  onChange,
  placeholder,
  type,
  className,
  min,
  step,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  className?: string
  min?: string
  step?: string
}) {
  return (
    <input
      type={type}
      value={value}
      min={min}
      step={step}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cx(
        "h-9 w-full rounded-xl border border-line bg-card px-3 text-xs text-fg outline-none transition-colors placeholder:text-fg-muted/60 focus:border-primary",
        className,
      )}
    />
  )
}

/* -------------------------------- Skeleton -------------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-xl bg-card-soft", className)} />
}

/* -------------------------------- Sparkline ------------------------------- */

export function Sparkline({
  data,
  width = 96,
  height = 28,
  color = "var(--primary)",
}: {
  data: number[]
  width?: number
  height?: number
  color?: string
}) {
  if (data.length < 2) return <div style={{ width, height }} />
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const span = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - 2 - ((v - min) / span) * (height - 4)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const style: CSSProperties = { width, height }
  return (
    <svg style={style} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

/* --------------------------------- StatusDot ------------------------------- */

export function StatusDot({ online, size = 8 }: { online: boolean; size?: number }) {
  return (
    <span
      className={cnDot(online)}
      style={{ width: size, height: size, boxShadow: online ? "0 0 0 3px color-mix(in srgb, var(--good) 22%, transparent)" : undefined }}
    />
  )
}

function cnDot(online: boolean) {
  return cx(
    "inline-block rounded-full",
    online ? "animate-dot bg-good" : "bg-fg-muted/50",
  )
}
