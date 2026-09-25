// 诊断地球视图白屏：开 earth 视图，打印控制台错误与页面状态
import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const PORT = 9952
const BASE = `http://127.0.0.1:${PORT}`
const mock = spawn(process.execPath, [path.join(root, "mock/server.mjs")], {
  env: { ...process.env, MOCK_PORT: String(PORT) },
  stdio: "inherit",
})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
for (let i = 0; i < 40; i++) {
  try { if ((await fetch(`${BASE}/api/me`)).ok) break } catch {}
  await sleep(250)
}

const { chromium } = await import("playwright-core")
let browser
for (const channel of ["msedge", "chrome"]) {
  try { browser = await chromium.launch({ channel, headless: true }); break } catch {}
}
if (!browser) browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
page.on("console", (m) => console.log("[console." + m.type() + "]", m.text().slice(0, 300)))
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 500)))
page.on("requestfailed", (r) => console.log("[requestfailed]", r.url().slice(0, 120), r.failure()?.errorText))
page.on("response", (r) => { if (r.status() >= 400) console.log("[http]", r.status(), r.url().slice(0, 120)) })

await page.addInitScript(() => {
  localStorage.setItem("mochi.view", JSON.stringify("earth"))
  localStorage.setItem("mochi.theme", JSON.stringify("dark"))
  localStorage.setItem("mochi.lang", JSON.stringify("zh-CN"))
})
await page.goto(`${BASE}/`, { waitUntil: "networkidle" })
await sleep(8000)
const globeCanvas = await page.locator("canvas").count()
const rootHTML = await page.evaluate(() => document.getElementById("root")?.innerHTML.length ?? -1)
console.log(`canvas=${globeCanvas} rootHTMLLen=${rootHTML}`)
await browser.close()
mock.kill()
process.exit(0)
