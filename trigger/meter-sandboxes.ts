import { logger, schedules } from "@trigger.dev/sdk"
import { SandboxState, type Sandbox } from "@daytona/sdk"
import { inArray } from "drizzle-orm"

import { db } from "@/db"
import { bots } from "@/db/schema"
import { daytona } from "@/lib/daytona"
import { sandboxCostMicros } from "@/lib/pricing"
import { getUsage, recordUsage, sandboxLeft, type Usage } from "@/lib/usage"

const EVERY_MINUTES = 5

// Charges running sandboxes to their owners' sandbox hours. Daytona bills per second of
// running time however the sandbox was woken (a chat turn, an open desktop), so this
// samples what is running instead of guessing from our own calls. A sandbox seen
// running is charged for the whole time since the last sample.
export const meterSandboxes = schedules.task({
  id: "meter-sandboxes",
  cron: `*/${EVERY_MINUTES} * * * *`,
  // Two overlapping samples would charge the same minutes twice
  queue: { concurrencyLimit: 1 },
  run: async ({ timestamp, lastTimestamp }) => {
    const elapsed = lastTimestamp
      ? (timestamp.getTime() - lastTimestamp.getTime()) / 1000
      : EVERY_MINUTES * 60
    // After an outage, don't charge for time nobody sampled
    const seconds = Math.round(Math.min(elapsed, 3 * EVERY_MINUTES * 60))

    const started: Sandbox[] = []
    for await (const sandbox of daytona.list({
      states: [SandboxState.STARTED],
    })) {
      if (sandbox.labels.botId && sandbox.labels.userId) started.push(sandbox)
    }

    // The Daytona organization may hold other environments' sandboxes too. Only the ones
    // whose bot is in this database are ours to charge and stop.
    const ours = started.length
      ? await db
          .select({ id: bots.id })
          .from(bots)
          .where(
            inArray(
              bots.id,
              started.map((sandbox) => sandbox.labels.botId)
            )
          )
      : []
    const ourBotIds = new Set(ours.map((bot) => bot.id))
    const running = started.filter((sandbox) =>
      ourBotIds.has(sandbox.labels.botId)
    )

    await recordUsage(
      running.map((sandbox) => ({
        userId: sandbox.labels.userId,
        meter: "sandbox" as const,
        costMicros: sandboxCostMicros(sandbox, seconds),
        quantity: seconds,
        botId: sandbox.labels.botId,
        detail: {
          sandboxId: sandbox.id,
          cpu: sandbox.cpu,
          memory: sandbox.memory,
          disk: sandbox.disk,
        },
      }))
    )

    // Stop the sandboxes of anyone out of hours, or without a plan any more
    const usageByUser = new Map<string, Promise<Usage | null>>()
    let stopped = 0
    for (const sandbox of running) {
      const { userId } = sandbox.labels
      if (!usageByUser.has(userId)) usageByUser.set(userId, getUsage(userId))
      const usage = await usageByUser.get(userId)
      if (usage && sandboxLeft(usage) > 0) continue

      await sandbox.stop().catch((error) => {
        logger.error("Couldn't stop sandbox", { sandboxId: sandbox.id, error })
      })
      stopped++
    }

    return { charged: running.length, seconds, stopped }
  },
})
