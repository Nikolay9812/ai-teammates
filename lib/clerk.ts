import "server-only"

import { createClerkClient } from "@clerk/backend"
import { isClerkAPIResponseError } from "@clerk/backend/errors"

// For code outside Next.js requests, like Trigger.dev tasks, where there is no session
// to call has() on. Reads CLERK_SECRET_KEY from the environment.
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

// The user's active paid plan with its billing period, or null on the free plan
export async function getActivePlan(userId: string) {
  let subscription
  try {
    subscription = await clerk.billing.getUserBillingSubscription(userId)
  } catch (error) {
    // Users who never had a plan have no subscription at all
    if (isClerkAPIResponseError(error) && error.status === 404) return null
    throw error
  }

  const item = subscription.subscriptionItems.find(
    (item) => item.status === "active" && item.plan && !item.plan.isDefault
  )
  if (!item?.plan) return null

  return {
    slug: item.plan.slug,
    features: item.plan.features.map((feature) => feature.slug),
    periodStart: new Date(item.periodStart),
    periodEnd: item.periodEnd === null ? null : new Date(item.periodEnd),
  }
}
