import { format } from "date-fns"

// Feature slugs in Clerk Billing. The Pro plan has them all, the free plan none.
export const BOTS = "bots"
export const SANDBOXES = "sandboxes"

export type Feature = typeof BOTS | typeof SANDBOXES

// Thrown by server checks; the client checks first and shows the upgrade toast
export const PLAN_REQUIRED = "Upgrade to Pro to use bots and sandboxes"

// What each paid plan allows per billing period, keyed by Clerk plan slug. Annual plans
// get the same allowance every month. Pro is $20 a month: these keep our cost under it.
export const PLAN_LIMITS: Record<string, PlanLimits> = {
  pro: {
    // Model cost, at the provider prices below
    aiMicros: 8_000_000,
    // Time sandboxes spend running, whatever they are doing
    sandboxSeconds: 60 * 60 * 60,
    // Bots at once; each one keeps a sandbox
    bots: 5,
  },
}

export type PlanLimits = {
  aiMicros: number
  sandboxSeconds: number
  bots: number
}

// Errors that start with this mean an allowance ran out, so the client links to usage
export const LIMIT_REACHED = "You've used up this period's"

export function limitMessage(allowance: string, resetsAt: Date) {
  return `${LIMIT_REACHED} ${allowance}. It resets on ${format(resetsAt, "MMMM d")}.`
}
