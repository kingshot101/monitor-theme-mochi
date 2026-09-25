import { useEffect, useMemo, useRef, useState } from "react"
import type { Node } from "@/lib/types"
import {
  aggregateByCountry,
  CountryNodeList,
  escapeHtml,
  pointColor,
  type CountryPoint,
} from "./EarthView"
import { cssVar } from "./ui"

/** globe.gl 3D 地球：按国家聚合标点，绿=全部在线 黄=部分离线 红=全部离线 */
type CountryFeature = { properties: { ISO_A2: string; ADM0_A3: string } }

// ne_110m 里少数国家 ISO_A2 是 -99（France/Norway 等），用 alpha-3 兜底映射
const A3_BY_CC: Record<string, string> = { FR: "FRA", NO: "NOR" }

function featureCC(f: CountryFeature): string | null {
  const iso = f.properties.ISO_A2
  if (iso && iso !== "-99") return iso
  const hit = Object.entries(A3_BY_CC).find(([, a3]) => a3 === f.properties.ADM0_A3)
  return hit ? hit[0] : null
}

// 一个中国：港澳台的节点并入中国的高亮（标点仍按各自位置显示）
const GREATER_CN = new Set(["HK", "MO", "TW"])
const highlightCC = (cc: string) => (GREATER_CN.has(cc) ? "CN" : cc)

/** 国家高亮配色：淡色填充 + 同色发光边框（与标点状态一致） */
function highlightColors(p: CountryPoint): [string, string] {
  if (p.online === 0) return ["rgba(239, 68, 68, 0.14)", "rgba(239, 68, 68, 0.9)"]
  if (p.online < p.count) return ["rgba(245, 158, 11, 0.14)", "rgba(245, 158, 11, 0.9)"]
  return ["rgba(34, 197, 94, 0.14)", "rgba(34, 197, 94, 0.9)"]
}

export default function EarthInner({ nodes }: { nodes: Node[] }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const globeRef = useRef<{
    _destructor?: () => void
    pointsData: (d: CountryPoint[]) => unknown
    polygonsData: (d: unknown[]) => unknown
    polygonAltitude: (a: number) => unknown
    polygonCapColor: (fn: (d: any) => string) => unknown
    polygonSideColor: (fn: (d: any) => string) => unknown
    polygonStrokeColor: (fn: (d: any) => string) => unknown
    polygonsTransitionDuration: (ms: number) => unknown
    onPolygonClick: (fn: (d: any) => void) => unknown
    width: (w: number) => unknown
    controls: () => { autoRotate: boolean; autoRotateSpeed: number; enableZoom: boolean }
  } | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [world, setWorld] = useState<CountryFeature[] | null>(null)

  const points = useMemo(() => aggregateByCountry(nodes), [nodes])

  // 国界数据（只取有节点的国家做高亮），加载失败静默降级为仅标点
  useEffect(() => {
    let on = true
    fetch("/assets/geo/countries.json")
      .then((r) => r.json())
      .then((g) => on && setWorld(g.features))
      .catch(() => {})
    return () => {
      on = false
    }
  }, [])

  useEffect(() => {
    let disposed = false
    let cleanup: (() => void) | null = null

    import("globe.gl")
      .then(({ default: Globe }) => {
        if (disposed || !boxRef.current) return
        const el = boxRef.current
        el.innerHTML = ""
        const width = el.clientWidth
        const height = Math.max(360, Math.min(560, Math.round(width * 0.6)))

        const label = (d: CountryPoint) => {
          const names = d.names.slice(0, 12).map(escapeHtml).join("<br/>")
          const more = d.names.length > 12 ? `<br/>+${d.names.length - 12} …` : ""
          return `<div style="font:12px/1.6 sans-serif;background:rgba(8,13,28,.94);border:1px solid ${cssVar("--primary", "#fbbf24")}66;border-radius:10px;padding:8px 12px;color:#f4ecf6;max-width:240px">
            <b>${escapeHtml(d.cc)}</b> · ${d.count} (${d.online} online)<br/>${names}${more}
          </div>`
        }

        const globe = new Globe(el)
        globe
          .width(width)
          .height(height)
          .backgroundColor("rgba(0,0,0,0)")
          .atmosphereColor(cssVar("--primary", "#fbbf24"))
          .atmosphereAltitude(0.16)
          .globeImageUrl("/assets/earth-dark.jpg")
          .pointsData(points)
          .pointLat((d: any) => d.lat)
          .pointLng((d: any) => d.lng)
          .pointColor((d: any) => pointColor(d))
          .pointAltitude((d: any) => 0.01 + Math.min(0.06, d.count * 0.015))
          .pointRadius((d: any) => 0.35 + Math.min(0.7, d.count * 0.14))
          .pointLabel(label as never)
          .onPointClick((d: any) => setSelected(d.cc))

        globe.pointOfView({ lat: 24, lng: 105, altitude: 2.5 }, 0)
        const controls = globe.controls()
        controls.autoRotate = true
        controls.autoRotateSpeed = 0.45
        controls.enableZoom = true

        const onResize = () => {
          if (!boxRef.current) return
          const w = boxRef.current.clientWidth
          globe.width(w)
          globe.height(Math.max(360, Math.min(560, Math.round(w * 0.6))))
        }
        window.addEventListener("resize", onResize)

        globeRef.current = globe as unknown as NonNullable<typeof globeRef.current>
        setReady(true)

        cleanup = () => {
          window.removeEventListener("resize", onResize)
          try {
            ;(globe as { _destructor?: () => void })._destructor?.()
          } catch {
            /* ignore */
          }
          el.innerHTML = ""
        }
      })
      .catch(() => setFailed(true))

    return () => {
      disposed = true
      cleanup?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 数据变化时原地刷新点位，不重建地球
  useEffect(() => {
    globeRef.current?.pointsData(points)
  }, [points, ready])

  // 有节点的国家边框发光高亮（国界数据/点位任一变化即重算）
  useEffect(() => {
    const globe = globeRef.current
    if (!globe || !world || !ready) return
    // 港澳台与大陆合并统计在线状态，作为「中国」整体高亮
    const status = new Map<string, CountryPoint>()
    for (const p of points) {
      const key = highlightCC(p.cc)
      const cur = status.get(key)
      if (cur) {
        cur.count += p.count
        cur.online += p.online
        cur.names.push(...p.names)
      } else {
        status.set(key, { ...p, cc: key })
      }
    }
    const highlights = world.filter((f) => {
      const cc = featureCC(f)
      return cc != null && status.has(highlightCC(cc))
    })
    const colorsOf = (f: CountryFeature): [string, string] => {
      const p = status.get(highlightCC(featureCC(f) ?? ""))
      return p ? highlightColors(p) : ["rgba(0,0,0,0)", "rgba(0,0,0,0)"]
    }
    globe.polygonsData(highlights)
    globe.polygonAltitude(0.006)
    globe.polygonCapColor((f: any) => colorsOf(f)[0])
    globe.polygonSideColor(() => "rgba(0,0,0,0)")
    globe.polygonStrokeColor((f: any) => colorsOf(f)[1])
    globe.polygonsTransitionDuration(400)
    globe.onPolygonClick((f: any) => {
      const cc = featureCC(f as CountryFeature)
      if (cc) setSelected((s) => (s === cc ? null : cc))
    })
  }, [world, points, ready])

  const toggle = (cc: string) => setSelected((s) => (s === cc ? null : cc))

  return (
    <div>
      <div
        className="relative overflow-hidden rounded-2xl border border-line"
        style={{ background: "radial-gradient(circle at 50% 35%, #16233f 0%, #0a1122 72%)" }}
      >
        <div ref={boxRef} className="flex justify-center" />
        {!ready && !failed && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-fg-muted">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-primary" />
          </div>
        )}
        {failed && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-fg-muted">
            WebGL unavailable
          </div>
        )}
        {/* 图例 */}
        <div className="absolute top-3 left-3 flex flex-col gap-1 rounded-xl border border-white/10 bg-black/35 p-2.5 text-[10px] text-white/75 backdrop-blur">
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-good" /> online</span>
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-warn" /> partial</span>
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-bad" /> offline</span>
        </div>
      </div>

      {/* 国家 chips */}
      {points.length > 0 && (
        <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto pb-0.5">
          {points.map((p) => (
            <button
              key={p.cc}
              onClick={() => toggle(p.cc)}
              className={`shrink-0 cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                selected === p.cc
                  ? "border-primary bg-primary text-on-primary"
                  : "border-line bg-card text-fg-muted hover:border-primary/40 hover:text-fg"
              }`}
            >
              {p.cc} <span className="tnum opacity-60">{p.count}</span>
            </button>
          ))}
        </div>
      )}
      <CountryNodeList nodes={nodes} cc={selected} />
    </div>
  )
}
