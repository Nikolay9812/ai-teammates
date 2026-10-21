import "server-only"

import { createClerkClient } from "@clerk/backend"

import type { Feature } from "@/lib/plan"

// For code outside Next.js requests, like Trigger.dev tasks, where there is no session
// to call has() on. Reads CLERK_SECRET_KEY from the environment.
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

// Whether the user's active plan has every feature
export async function userHasFeatures(userId: string, features: Feature[]) {
  const subscription = await clerk.billing.getUserBillingSubscription(userId)
  const granted = new Set(
    subscription.subscriptionItems
      .filter((item) => item.status === "active")
      .flatMap((item) => item.plan?.features ?? [])
      .map((feature) => feature.slug)
  )
  return features.every((feature) => granted.has(feature))
}
