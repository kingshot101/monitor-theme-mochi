import { describe, expect, it } from "vitest"
import { bps, bytes, cycleLabel, flagEmoji, money, osEmoji, pct, uptime } from "@/lib/format"

describe("format", () => {
  it("bytes", () => {
    expect(bytes(0)).toBe("0 B")
    expect(bytes(1024)).toBe("1.0 KB")
    expect(bytes(1536 * 1024 ** 2)).toBe("1.5 GB")
    expect(bytes(null)).toBe("—")
    expect(bytes(NaN)).toBe("—")
  })

  it("bps", () => {
    expect(bps(1024 ** 2)).toBe("1.0 MB/s")
    expect(bps(undefined)).toBe("—")
    expect(bps(-1)).toBe("—")
  })

  it("pct / uptime", () => {
    expect(pct(12.34)).toBe("12.3%")
    expect(pct(null)).toBe("—")
    expect(uptime(90000)).toBe("1d 1h")
    expect(uptime(3600 * 5 + 60)).toBe("5h 1m")
  })

  it("money 按货币取符号", () => {
    expect(money(39.9, "CNY")).toBe("¥39.90")
    expect(money(59.99, "USD")).toBe("$59.99")
    expect(money(1200, "USD")).toBe("$1,200")
    expect(money(12.9, "BRL")).toContain("BRL")
    expect(money(undefined, "USD")).toBe("—")
  })

  it("cycleLabel", () => {
    expect(cycleLabel("monthly", "zh-CN")).toBe("月付")
    expect(cycleLabel("triennial", "en")).toBe("Triennial")
    expect(cycleLabel("weird", "en")).toBe("weird")
    expect(cycleLabel("", "en")).toBe("—")
  })

  it("flagEmoji / osEmoji", () => {
    expect(flagEmoji("hk")).toBe("🇭🇰")
    expect(flagEmoji("")).toBe("🌐")
    expect(flagEmoji("x")).toBe("🌐")
    expect(osEmoji("Windows Server 2022")).toBe("🪟")
    expect(osEmoji("darwin")).toBe("🍎")
    expect(osEmoji("android 14")).toBe("🤖")
    expect(osEmoji("debian 12")).toBe("🐧")
  })
})
