// 把 three-globe 自带的地球贴图复制进 public/assets，避免主题运行期外链
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const src = path.join(root, "node_modules/three-globe/example/img/earth-dark.jpg")
const dst = path.join(root, "public/assets/earth-dark.jpg")

mkdirSync(path.dirname(dst), { recursive: true })
if (existsSync(src)) {
  copyFileSync(src, dst)
  console.log(`[assets] earth-dark.jpg -> public/assets (${(statSync(dst).size / 1024).toFixed(0)} KB)`)
} else {
  console.warn("[assets] three-globe 贴图不存在，地球将使用纯色球体（不影响功能）")
}
