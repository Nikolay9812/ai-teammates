import type { LanguageModelUsage } from "ai"

// Provider list prices. A price in US dollars per million tokens is also the price in
// millionths of a dollar per token, which is the unit the usage ledger counts in.
type TokenPrices = {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

// https://platform.claude.com/docs/en/about-claude/pricing and
// https://ai.google.dev/gemini-api/docs/pricing, checked 2026-10-21.
// Anthropic bills a 5-minute cache write at 1.25x input. Google doesn't say which model
// gemini-flash-lite-latest points to, so it's priced as Gemini 3.5 Flash-Lite, the newest.
const TOKEN_PRICES: Record<string, TokenPrices> = {
  "claude-sonnet-5-5": {
    input: 2,
    output: 10,
    cacheRead: 0.2,
    cacheWrite: 2.5,
  },
  "gemini-flash-lite-latest": {
    input: 0.3,
    output: 2.5,
    cacheRead: 0.03,
    cacheWrite: 0.3,
  },
}

// A model missing above is charged as the dearest one, so it can't run up free usage
const FALLBACK_PRICES = TOKEN_PRICES["claude-sonnet-5-5"]

// What one model call cost, in millionths of a dollar
export function tokenCostMicros(modelId: string, usage: LanguageModelUsage) {
  const prices = TOKEN_PRICES[modelId] ?? FALLBACK_PRICES
  const cacheRead = usage.inputTokenDetails.cacheReadTokens ?? 0
  const cacheWrite = usage.inputTokenDetails.cacheWriteTokens ?? 0
  const uncached =
    usage.inputTokenDetails.noCacheTokens ??
    Math.max(0, (usage.inputTokens ?? 0) - cacheRead - cacheWrite)

  return Math.ceil(
    uncached * prices.input +
      cacheRead * prices.cacheRead +
      cacheWrite * prices.cacheWrite +
      (usage.outputTokens ?? 0) * prices.output
  )
}

// https://www.daytona.io/pricing, checked 2026-10-21: $0.0504 per vCPU-hour, $0.0162 per
// GiB-hour of memory and $0.000108 per GiB-hour of disk, billed per second
const SANDBOX_MICROS_PER_SECOND = {
  vcpu: 14,
  memoryGib: 4.5,
  diskGib: 0.03,
}

// What a running sandbox of this size costs for the given time, in millionths of a dollar
export function sandboxCostMicros(
  size: { cpu: number; memory: number; disk: number },
  seconds: number
) {
  return Math.ceil(
    seconds *
      (size.cpu * SANDBOX_MICROS_PER_SECOND.vcpu +
        size.memory * SANDBOX_MICROS_PER_SECOND.memoryGib +
        size.disk * SANDBOX_MICROS_PER_SECOND.diskGib)
  )
}
