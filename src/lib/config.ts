import manifest from "../../theme.json"

type Field = {
  key: string
  type: string
  default: unknown
  options?: { value: string; label: string }[]
  min?: number
  max?: number
}

/** 与面板同一套取值检查：保存值可能来自主题旧版本，对不上就当作没保存过 */
function fits(field: Field, value: unknown): boolean {
  switch (field.type) {
    case "boolean":
      return typeof value === "boolean"
    case "number":
      return (
        typeof value === "number" &&
        Number.isFinite(value) &&
        value >= (field.min ?? -Infinity) &&
        value <= (field.max ?? Infinity)
      )
    case "select":
      return !!field.options?.some((option) => option.value === value)
    default:
      return typeof value === "string"
  }
}

export const CONFIG_FIELDS = (manifest.config as Field[]).filter((f) => f.type !== "title")

/** 主题站点设置：theme.json 默认值 + hub 已存值（并行请求，失败按默认值渲染） */
export async function loadConfig(): Promise<Record<string, unknown>> {
  let saved: Record<string, unknown> = {}
  try {
    const res = await fetch(`/api/themes/${manifest.short}/config`)
    if (res.ok) saved = await res.json()
  } catch {
    /* 断网同样按默认值 */
  }
  const pick = (f: Field) => (fits(f, saved[f.key]) ? saved[f.key] : f.default)
  return Object.fromEntries(CONFIG_FIELDS.map((f) => [f.key, pick(f)]))
}

export type ThemeManifest = typeof manifest
export const THEME_MANIFEST = manifest
