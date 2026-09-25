// mock hub —— 无真机时开发/验收用：提供与 monitor hub 相同契约的 API 与静态页
// 用法：npm run build && npm run mock  → http://127.0.0.1:9911
import http from "node:http"
import { readFileSync, existsSync, statSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { WebSocketServer } from "ws"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.MOCK_PORT || 9911)
const DIST = path.resolve(__dirname, "../dist")

const DAY = 86400000

function mkNode(i, o) {
  const base = {
    id: i,
    name: "node",
    sort: i,
    public: true,
    online: true,
    country: "us",
    group: "",
    last_seen: Date.now() - 5000,
    os: "debian",
    kernel: "6.1.0-18-amd64",
    arch: "x86_64",
    virt: "kvm",
    cpu_name: "AMD EPYC 9654",
    cpu_cores: 4,
    mem_total: 8 * 1024 ** 3,
    swap_total: 1024 ** 3,
    disk_total: 80 * 1024 ** 3,
    agent_version: "1.0.0",
    price: 0,
    currency: "",
    billing_cycle: "",
    expires_at: null,
    expires_in: null,
    traffic_limit: 0,
    traffic_mode: "sum",
    traffic_reset_day: 1,
    total_rx: 2.4 * 1024 ** 4,
    total_tx: 1.8 * 1024 ** 4,
    month_rx: 320 * 1024 ** 3,
    month_tx: 210 * 1024 ** 3,
    month_start: new Date(Date.now() - 12 * DAY).toISOString(),
    day_rx: 3.2 * 1024 ** 3,
    day_tx: 2.1 * 1024 ** 3,
  }
  return { ...base, ...o }
}

const NODES = [
  mkNode(1, { name: "HK-01 香港国际", country: "hk", group: "香港", os: "debian", cpu_cores: 2, mem_total: 2 * 1024 ** 3, disk_total: 40 * 1024 ** 3, price: 39.9, currency: "CNY", billing_cycle: "monthly", expires_at: new Date(Date.now() + 23 * DAY).toISOString(), expires_in: 23, traffic_limit: 1024 ** 4 }),
  mkNode(2, { name: "HK-02 大带宽", country: "hk", group: "香港", os: "ubuntu", cpu_cores: 4, mem_total: 8 * 1024 ** 3, price: 59.99, currency: "USD", billing_cycle: "yearly", expires_at: new Date(Date.now() + 2 * DAY).toISOString(), expires_in: 2, traffic_limit: 5 * 1024 ** 4 }),
  mkNode(3, { name: "JP-大阪 BGP", country: "jp", group: "日本", os: "almalinux", cpu_cores: 2, mem_total: 4 * 1024 ** 3, price: 128, currency: "CNY", billing_cycle: "quarterly", expires_at: new Date(Date.now() + 158 * DAY).toISOString(), expires_in: 158, traffic_limit: 3 * 1024 ** 4 }),
  mkNode(4, { name: "JP-东京 NVMe", country: "jp", group: "日本", os: "rocky", cpu_cores: 8, mem_total: 16 * 1024 ** 3, disk_total: 160 * 1024 ** 3, price: 199, currency: "CNY", billing_cycle: "semiannual", expires_at: new Date(Date.now() - 3 * DAY).toISOString(), expires_in: -3 }),
  mkNode(5, { name: "SG-狮城 01", country: "sg", group: "狮城", os: "debian", price: 89, currency: "USD", billing_cycle: "yearly", expires_in: null, expires_at: null, traffic_limit: 10 * 1024 ** 4 }),
  mkNode(6, { name: "US-洛杉矶 CN2", country: "us", group: "美国", os: "ubuntu", cpu_name: "Intel Xeon Platinum 8260", price: 199, currency: "USD", billing_cycle: "triennial", expires_at: new Date(Date.now() + 777 * DAY).toISOString(), expires_in: 777 }),
  mkNode(7, { name: "DE-法兰克福", country: "de", group: "欧洲", os: "debian", price: 12.9, currency: "EUR", billing_cycle: "monthly", expires_at: new Date(Date.now() + 12 * DAY).toISOString(), expires_in: 12, online: false, metrics: null, last_seen: Date.now() - 3 * 3600 * 1000 }),
  mkNode(8, { name: "UK-伦敦 买断机", country: "gb", group: "欧洲", os: "debian", price: 899, currency: "CNY", billing_cycle: "once", expires_in: null, expires_at: null }),
  mkNode(9, { name: "家宽-NAS", country: "cn", group: "", os: "pve", virt: "bare", cpu_name: "Intel N100", cpu_cores: 4, mem_total: 16 * 1024 ** 3, disk_total: 512 * 1024 ** 3, price: 0, currency: "", billing_cycle: "", expires_at: new Date(Date.now() + 45 * DAY).toISOString(), expires_in: 45 }),
  mkNode(10, { name: "TW-台北 Hinet", country: "tw", group: "亚太", os: "centos", price: 1350, currency: "TWD", billing_cycle: "yearly", expires_at: new Date(Date.now() + 6 * DAY).toISOString(), expires_in: 6, traffic_limit: 1024 ** 4 }),
]

function rand(n) {
  return n * (0.9 + Math.random() * 0.2)
}
function metricsFor(n) {
  if (!n.online) return null
  const cpu = rand(18 + (n.id % 5) * 9)
  return {
    uptime: Math.floor(rand(40 * 86400 + n.id * 3600 * 7)),
    cpu: +cpu.toFixed(1),
    load: [rand(0.8), rand(0.7), rand(0.6)],
    mem_total: n.mem_total,
    mem_used: Math.floor(rand(n.mem_total * 0.55)),
    swap_total: n.swap_total,
    swap_used: Math.floor(rand(n.swap_total * 0.1)),
    disk_total: n.disk_total,
    disk_used: Math.floor(rand(n.disk_total * 0.4)),
    net_rx: Math.floor(rand((3 + (n.id % 4) * 2) * 1024 ** 2)),
    net_tx: Math.floor(rand((2 + (n.id % 3) * 2) * 1024 ** 2)),
    total_rx: n.total_rx,
    total_tx: n.total_tx,
    month_rx: n.month_rx,
    month_tx: n.month_tx,
    tcp: Math.floor(rand(60)),
    udp: Math.floor(rand(20)),
    procs: Math.floor(rand(180)),
  }
}
function snapshot() {
  return NODES.map((n) => ({ ...n, metrics: metricsFor(n) }))
}

const PROBE_NAMES = ["1.1.1.1", "9.9.9.9", "223.5.5.5"]
function historyFor(id, hours, points, series) {
  const now = Math.floor(Date.now() / 1000)
  const step = (hours * 3600) / points
  if (series === "ping") {
    const ping = []
    const probes = {}
    PROBE_NAMES.forEach((name, i) => (probes[`t${i + 1}`] = name))
    const loss = {}
    PROBE_NAMES.forEach((_, i) => (loss[`t${i + 1}`] = +(Math.random() * 3).toFixed(2)))
    for (let p = points; p > 0; p--) {
      const ts = now - p * step
      PROBE_NAMES.forEach((_, i) => {
        const dead = Math.random() < 0.015
        ping.push({
          task_id: `t${i + 1}`,
          ts,
          latency: dead ? null : +(20 + i * 18 + Math.random() * 25).toFixed(1),
          loss: dead ? 100 : 0,
        })
      })
    }
    return { ping, probes, loss }
  }
  const metrics = []
  let cpu = 20
  for (let p = points; p > 0; p--) {
    const ts = now - p * step
    cpu = Math.max(2, Math.min(96, cpu + (Math.random() - 0.5) * 14))
    metrics.push({
      ts,
      cpu: +cpu.toFixed(1),
      mem_used: Math.floor(rand(NODES[id - 1]?.mem_total ?? 8e9) * 0.55),
      disk_used: Math.floor((NODES[id - 1]?.disk_total ?? 80e9) * 0.4),
      net_rx: Math.floor(rand(4 * 1024 ** 2)),
      net_tx: Math.floor(rand(2.5 * 1024 ** 2)),
    })
  }
  return { metrics, ping: [], probes: {} }
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
}

function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj)
  res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" })
  res.end(body)
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const p = url.pathname
  try {
    if (p === "/api/me") {
      return sendJSON(res, 200, { authed: false, github: false, site_name: "Mochi 监控站", public_page: true })
    }
    if (p === "/api/nodes") {
      return sendJSON(res, 200, { nodes: snapshot() })
    }
    if (p === "/api/themes/mochi/config") {
      return sendJSON(res, 200, { notice: "示例公告：本站为 Mochi 主题演示，节点与数据均为模拟数据。" })
    }
    const m = p.match(/^\/api\/nodes\/(\d+)\/metrics$/)
    if (m) {
      const hours = Math.min(168, Number(url.searchParams.get("hours") || 1))
      const points = Math.min(1440, Math.max(1, Number(url.searchParams.get("points") || 240)))
      const series = url.searchParams.get("series") === "ping" ? "ping" : "metrics"
      return sendJSON(res, 200, historyFor(Number(m[1]), hours, points, series))
    }
    if (p.startsWith("/api/")) return sendJSON(res, 404, { error: "not found" })

    // 静态文件 + SPA fallback
    let file = path.join(DIST, p === "/" ? "index.html" : p.replace(/^\//, ""))
    if (!existsSync(file) || statSync(file).isDirectory()) file = path.join(DIST, "index.html")
    if (!existsSync(file)) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" })
      return res.end("<h1>Mochi mock hub</h1><p>先运行 <code>npm run build</code> 生成 dist/</p>")
    }
    const ext = path.extname(file).toLowerCase()
    const cache = file.includes(`${path.sep}assets${path.sep}`) ? "public, max-age=31536000, immutable" : "no-cache"
    res.writeHead(200, { "content-type": MIME[ext] ?? "application/octet-stream", "cache-control": cache })
    res.end(readFileSync(file))
  } catch (e) {
    sendJSON(res, 500, { error: String(e) })
  }
})

const wss = new WebSocketServer({ server })
wss.on("connection", (ws) => {
  const send = () => {
    try {
      ws.send(JSON.stringify({ nodes: snapshot() }))
    } catch {
      /* ignore */
    }
  }
  send()
  const timer = setInterval(send, 2000)
  ws.on("close", () => clearInterval(timer))
  ws.on("error", () => clearInterval(timer))
})

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[mock-hub] http://127.0.0.1:${PORT}  (dist: ${DIST})`)
})
