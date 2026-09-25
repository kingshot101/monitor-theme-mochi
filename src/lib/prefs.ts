/** 访客本地偏好（localStorage，"mochi." 前缀）。站点级设置走 /api/themes/{short}/config，勿存这里。 */

const P = "mochi."

export function loadLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(P + key)
    if (raw == null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function saveLS(key: string, value: unknown) {
  try {
    localStorage.setItem(P + key, JSON.stringify(value))
  } catch {
    /* 隐私模式等场景静默失败 */
  }
}

export function removeLS(key: string) {
  try {
    localStorage.removeItem(P + key)
  } catch {
    /* ignore */
  }
}

/* ------------------------------ 简单外置存储 hook ----------------------------- */

const subMap = new Map<string, Set<() => void>>()

export function subscribeKey(key: string, l: () => void): () => void {
  let set = subMap.get(key)
  if (!set) {
    set = new Set()
    subMap.set(key, set)
  }
  set.add(l)
  return () => set!.delete(l)
}

export function emitKey(key: string) {
  subMap.get(key)?.forEach((l) => l())
}

export function snapshotKey<T>(key: string, fallback: T): T {
  return loadLS<T>(key, fallback)
}
