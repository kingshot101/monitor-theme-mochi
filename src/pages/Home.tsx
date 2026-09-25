import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useNodes, startLive } from "@/lib/api"
import { useApp, filterNodes } from "@/context"
import { GroupTabs, LiveBadge, StatusBar, ViewModeSelector } from "@/components/StatusBar"
import { FloatingMenu } from "@/components/FloatingMenu"
import { ClassicView } from "@/components/Classic"
import { DetailedView } from "@/components/Classic"
import { ModernView, CompactView } from "@/components/Modern"
import { TaskView } from "@/components/Task"
import { EarthView } from "@/components/EarthView"
import { Badge, Card, Skeleton } from "@/components/ui"

export function HomePage() {
  const { t } = useTranslation()
  const { nodes, error } = useNodes()
  const { view, sort, group, search, cfgStr } = useApp()

  useEffect(() => {
    startLive()
  }, [])

  const { main, offline } = nodes ? filterNodes(nodes, group, search, sort) : { main: [], offline: [] }
  const notice = cfgStr("notice", "")
  const footerText = cfgStr("footer_text", "")

  return (
    <div className="min-h-screen">
      <StatusBar />

      {notice && (
        <div className="mx-auto max-w-7xl px-4 pt-3">
          <div className="rounded-xl border border-primary/30 bg-primary-soft/60 px-4 py-2.5 text-xs text-fg">
            📢 {notice}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-4">
        <GroupTabs />

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold">{t("site.status")}</h1>
            <LiveBadge />
          </div>
          <ViewModeSelector />
        </div>

        {!nodes && !error && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-56" />
            ))}
          </div>
        )}

        {error && (
          <Card className="p-8 text-center text-sm text-bad">
            {t("site.loadError")} · {error}
          </Card>
        )}

        {nodes && main.length === 0 && offline.length === 0 && (
          <div className="py-16 text-center text-sm text-fg-muted">
            {search ? t("site.noMatch") : t("site.noNodes")}
          </div>
        )}

        {nodes && view === "modern" && <ModernView nodes={main} />}
        {nodes && view === "compact" && <CompactView nodes={main} />}
        {nodes && view === "classic" && <ClassicView nodes={main} />}
        {nodes && view === "detailed" && <DetailedView nodes={main} />}
        {nodes && view === "task" && <TaskView nodes={main} />}
        {nodes && view === "earth" && <EarthView nodes={main} />}

        {/* 离线节点区（mochi/官方惯例：离线单独折叠在底部） */}
        {nodes && offline.length > 0 && (
          <>
            <div className="mt-6 mb-3 flex items-center gap-2">
              <Badge tone="bad">
                {t("site.offlineNodes")} {offline.length}
              </Badge>
            </div>
            {view === "modern" ? (
              <ModernView nodes={offline} />
            ) : view === "compact" ? (
              <CompactView nodes={offline} />
            ) : view === "detailed" ? (
              <DetailedView nodes={offline} />
            ) : (
              <ClassicView nodes={offline} />
            )}
          </>
        )}

        <footer className="py-8 text-center text-[11px] text-fg-muted/70">
          {footerText || t("site.poweredBy")}
        </footer>
      </main>

      <FloatingMenu />
    </div>
  )
}
