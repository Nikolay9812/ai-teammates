"use client"

import { useAuth } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { useCallback } from "react"

import { toast } from "@/components/ui/toast"
import type { Feature } from "@/lib/plan"

// Whether the signed-in user's plan has every feature. When it doesn't, a toast
// explains why and links to the pricing page, which is reachable from nowhere else.
export function usePlanGate() {
  const { has } = useAuth()
  const router = useRouter()

  return useCallback(
    (...features: Feature[]) => {
      if (has && features.every((feature) => has({ feature }))) return true

      toast.add({
        type: "error",
        title: "Upgrade to Pro",
        description: "Bots and their sandboxes are part of the Pro plan.",
        actionProps: {
          children: "See plans",
          onClick: () => router.push("/pricing"),
        },
      })
      return false
    },
    [has, router]
  )
}

// Shows a limit the server reported, with a link to the usage page
export function useLimitToast() {
  const router = useRouter()

  return useCallback(
    (description: string) => {
      toast.add({
        type: "error",
        title: "Plan limit reached",
        description,
        actionProps: {
          children: "See usage",
          onClick: () => router.push("/usage"),
        },
      })
    },
    [router]
  )
}
