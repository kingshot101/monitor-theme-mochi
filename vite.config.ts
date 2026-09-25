import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import path from "node:path"

// 主题包要求 dist/index.html 用相对路径引用资源（hub 按静态目录原样提供）
const hub = process.env.MONITOR_HUB || "http://127.0.0.1:9911"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // hub 把主题挂在站点根（/），客户端路由有 /instance/:id 子路径，必须用绝对根，
  // 相对路径会在子路由下解析成 /instance/assets/... 被 SPA fallback 劫持
  base: "/",
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: {
    port: 5180,
    proxy: {
      "/api": { target: hub, changeOrigin: true, ws: true },
    },
  },
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 1500,
  },
  test: {
    include: ["test/**/*.spec.ts"],
  },
})
