// GUI 截图：起 mock hub（dist 静态 + API），用系统 Edge/Chrome 截图到 shots/
// 前置：npm run build（playwright-core 在 devDependencies，浏览器用系统 Edge/Chrome）
import { spawn } from "node:child_process"
import { mkdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const PORT = 9950
const BASE = `http://127.0.0.1:${PORT}`
const OUT = path.join(root, "shots")
mkdirSync(OUT, { recursive: true })

const mock = spawn(process.execPath, [path.join(root, "mock/server.mjs")], {
  env: { ...process.env, MOCK_PORT: String(PORT) },
  stdio: "inherit",
})

const { chromium } = await import("playwright-core")

async function launch() {
  for (const channel of ["msedge", "chrome", "msedge-beta", "chrome-beta"]) {
    try {
      return await chromium.launch({ channel, headless: true })
    } catch (e) {
      console.log(`[shots] channel ${channel} 不可用: ${e.message.split("\n")[0]}`)
    }
  }
  return chromium.launch({ headless: true })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function newPage(ctx, { view = null, dark = false, lang = "zh-CN", mobile = false } = {}) {
  const page = await ctx.newPage()
  await page.addInitScript(
    ([v, d, l]) => {
      localStorage.setItem("mochi.view", JSON.stringify(v))
      localStorage.setItem("mochi.theme", JSON.stringify(d ? "dark" : "light"))
      localStorage.setItem("mochi.lang", JSON.stringify(l))
    },
    [view, dark, lang],
  )
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 })
  return page
}

// 等服务就绪后逐个场景即时截图（不能攒到最后：弹窗状态会失效）
try {
  const browser = await launch()
  const ctx = await browser.newContext()

  for (let i = 0; i < 40; i++) {
    try {
      if ((await fetch(`${BASE}/api/me`)).ok) break
    } catch {}
    await sleep(250)
  }

  // 六种视图（亮色）
  for (const view of ["modern", "compact", "classic", "detailed", "task", "earth"]) {
    const page = await newPage(ctx, { view })
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" })
    if (view === "task") {
      // 等各节点 ping 图表加载完（spinner 消失）再拍，避免冷启动时机偶发
      await page
        .waitForFunction(() => document.querySelectorAll(".animate-spin").length === 0, { timeout: 20000 })
        .catch(() => {})
      await sleep(800)
    } else {
      await sleep(view === "earth" ? 6000 : 1600)
    }
    await page.screenshot({ path: path.join(OUT, `01-${view}.png`), fullPage: view !== "earth" })
    await page.close()
  }

  // 暗色 Modern
  {
    const page = await newPage(ctx, { view: "modern", dark: true })
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" })
    await sleep(1600)
    await page.screenshot({ path: path.join(OUT, "02-modern-dark.png"), fullPage: true })
    await page.close()
  }

  // 详情页
  {
    const page = await newPage(ctx, { dark: true })
    await page.goto(`${BASE}/instance/1`, { waitUntil: "networkidle" })
    await sleep(4500)
    await page.screenshot({ path: path.join(OUT, "03-detail.png"), fullPage: true })
    await page.close()
  }

  // 剩余价值悬浮窗（有价格 / 无价格补录）
  for (const [nth, name] of [
    [1, "04-value-dialog"],
    [7, "05-value-dialog-no-price"],
  ]) {
    const page = await newPage(ctx, { view: "modern", dark: true })
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" })
    await sleep(1500)
    await page.locator("[data-value-btn]").nth(nth).click()
    await sleep(900)
    await page.screenshot({ path: path.join(OUT, `${name}.png`) })
    await page.close()
  }

  // 剩余价值总览
  {
    const page = await newPage(ctx, { view: "modern", dark: true })
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" })
    await sleep(1500)
    await page.locator('button[title="Mochi"]').click()
    await sleep(400)
    await page.locator('button[title="剩余价值总览"]').click()
    await sleep(900)
    await page.screenshot({ path: path.join(OUT, "06-value-summary.png") })
    await page.close()
  }

  // 移动端
  {
    const page = await newPage(ctx, { view: "modern", dark: true, mobile: true })
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" })
    await sleep(1600)
    await page.screenshot({ path: path.join(OUT, "07-mobile-modern.png"), fullPage: true })
    await page.close()
  }

  await browser.close()
  console.log("[shots] done -> shots/")
} finally {
  mock.kill()
}
