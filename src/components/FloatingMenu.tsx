import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ArrowUp, ChevronUp, Languages, Moon, RefreshCw, Sun, Wallet } from "lucide-react"
import { useNodes } from "@/lib/api"
import { useApp } from "@/context"
import { Button, cx } from "@/components/ui"
import { ValueSummary } from "@/value/ValueSummary"

/** 右下角浮动菜单：剩余价值总览 / 亮暗 / 语言 / 刷新 / 回顶部（mochi FloatingMenu 的还原 + 价值入口） */
export function FloatingMenu() {
  const { t } = useTranslation()
  const { mode, setMode, lang, toggleLang } = useApp()
  const { nodes } = useNodes()
  const [open, setOpen] = useState(false)
  const [summary, setSummary] = useState(false)

  const actions = [
    {
      icon: <Wallet size={16} />,
      label: t("menu.summary"),
      primary: true,
      onClick: () => {
        setSummary(true)
        setOpen(false)
      },
    },
    {
      icon: mode === "dark" ? <Sun size={16} /> : <Moon size={16} />,
      label: t("menu.theme"),
      onClick: () => setMode(mode === "dark" ? "light" : "dark"),
    },
    { icon: <Languages size={16} />, label: t("menu.lang"), onClick: toggleLang },
    {
      icon: <RefreshCw size={16} />,
      label: t("menu.refresh"),
      onClick: () => location.reload(),
    },
    {
      icon: <ArrowUp size={16} />,
      label: t("menu.top"),
      onClick: () => window.scrollTo({ top: 0, behavior: "smooth" }),
    },
  ]

  return (
    <>
      <div className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-2 sm:right-6 sm:bottom-6">
        <div className="flex flex-col items-end gap-2">
          {actions.map((a, i) => (
            <button
              key={i}
              title={a.label}
              onClick={a.onClick}
              className={cx(
                "flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border shadow-lg transition-all duration-200",
                open
                  ? "translate-y-0 scale-100 opacity-100"
                  : "pointer-events-none translate-y-3 scale-75 opacity-0",
                a.primary
                  ? "border-primary/40 bg-primary text-on-primary hover:bg-primary-strong"
                  : "border-line bg-card text-fg-muted hover:text-primary",
              )}
            >
              {a.icon}
            </button>
          ))}
        </div>
        <Button
          variant="primary"
          className="h-12 w-12 rounded-full shadow-xl"
          onClick={() => setOpen(!open)}
          title="Mochi"
        >
          <ChevronUp
            size={20}
            className={cx("transition-transform duration-200", open && "rotate-180")}
          />
        </Button>
      </div>
      <ValueSummary open={summary} onClose={() => setSummary(false)} nodes={nodes ?? []} />
    </>
  )
}
