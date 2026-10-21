import "server-only"

import { addMonths } from "date-fns"
import { and, count, eq, gte, lt, sql } from "drizzle-orm"

import { db } from "@/db"
import { bots, type NewUsageEntry, usageEntries } from "@/db/schema"
import { getActivePlan } from "@/lib/clerk"
import { BOTS, PLAN_LIMITS, SANDBOXES } from "@/lib/plan"

// The month of the billing period that `now` falls in. Monthly plans get the period
// itself; annual plans get a fresh allowance on each monthly anniversary of the start.
function usageWindow(periodStart: Date, periodEnd: Date | null, now: Date) {
  let months = 0
  while (addMonths(periodStart, months + 1) <= now) months++
  const start = addMonths(periodStart, months)
  const monthEnd = addMonths(periodStart, months + 1)
  return {
    start,
    end: periodEnd && periodEnd < monthEnd ? periodEnd : monthEnd,
  }
}

// What the user's plan allows this period and how much of it is used. Null when they
// have no plan with bots and sandboxes, which means no usage at all.
export async function getUsage(userId: string, now = new Date()) {
  const plan = await getActivePlan(userId)
  const limits = plan && PLAN_LIMITS[plan.slug]
  if (!plan || !limits) return null
  if (!plan.features.includes(BOTS) || !plan.features.includes(SANDBOXES)) {
    return null
  }

  const period = usageWindow(plan.periodStart, plan.periodEnd, now)

  const [meters, [{ botCount }]] = await Promise.all([
    db
      .select({
        meter: usageEntries.meter,
        costMicros:
          sql<number>`coalesce(sum(${usageEntries.costMicros}), 0)`.mapWith(
            Number
          ),
        quantity:
          sql<number>`coalesce(sum(${usageEntries.quantity}), 0)`.mapWith(
            Number
          ),
      })
      .from(usageEntries)
      .where(
        and(
          eq(usageEntries.userId, userId),
          gte(usageEntries.createdAt, period.start),
          lt(usageEntries.createdAt, period.end)
        )
      )
      .groupBy(usageEntries.meter),
    db.select({ botCount: count() }).from(bots).where(eq(bots.userId, userId)),
  ])

  const ai = meters.find((row) => row.meter === "ai")
  const sandbox = meters.find((row) => row.meter === "sandbox")

  return {
    plan: plan.slug,
    period,
    ai: {
      usedMicros: ai?.costMicros ?? 0,
      limitMicros: limits.aiMicros,
      tokens: ai?.quantity ?? 0,
    },
    sandbox: {
      usedSeconds: sandbox?.quantity ?? 0,
      limitSeconds: limits.sandboxSeconds,
    },
    bots: { used: botCount, limit: limits.bots },
  }
}

export type Usage = NonNullable<Awaited<ReturnType<typeof getUsage>>>

export const aiLeft = (usage: Usage) =>
  usage.ai.limitMicros - usage.ai.usedMicros
export const sandboxLeft = (usage: Usage) =>
  usage.sandbox.limitSeconds - usage.sandbox.usedSeconds

export async function recordUsage(entries: NewUsageEntry[]) {
  if (entries.length > 0) await db.insert(usageEntries).values(entries)
}
