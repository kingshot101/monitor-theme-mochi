// 诊断 Task 视图 spinner：起 mock，打开 task 视图，观察图表数量与网络/控制台
import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const PORT = 9951
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
page.on("console", (m) => m.type() === "error" && console.log("[console.error]", m.text().slice(0, 200)))
page.on("requestfailed", (r) => console.log("[requestfailed]", r.url().slice(0, 120), r.failure()?.errorText))
page.on("response", (r) => { if (r.status() >= 400) console.log("[http]", r.status(), r.url().slice(0, 120)) })

await page.addInitScript(() => {
  localStorage.setItem("mochi.view", JSON.stringify("task"))
  localStorage.setItem("mochi.theme", JSON.stringify("light"))
  localStorage.setItem("mochi.lang", JSON.stringify("zh-CN"))
})
await page.goto(`${BASE}/`, { waitUntil: "networkidle" })
let t = 0
for (const wait of [3000, 5000, 6000]) {
  await sleep(wait)
  t += wait
  const charts = await page.locator(".recharts-wrapper").count()
  const spinners = await page.locator(".animate-spin").count()
  console.log(`[t=${t}s] recharts-wrapper=${charts} spinners=${spinners}`)
}
await browser.close()
mock.kill()
process.exit(0)
