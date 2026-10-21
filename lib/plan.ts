// Feature slugs in Clerk Billing. The Pro plan has them all, the free plan none.
export const BOTS = "bots"
export const SANDBOXES = "sandboxes"

export type Feature = typeof BOTS | typeof SANDBOXES

// Thrown by server checks; the client checks first and shows the upgrade toast
export const PLAN_REQUIRED = "Upgrade to Pro to use bots and sandboxes"
