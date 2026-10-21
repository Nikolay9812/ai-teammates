import { auth } from "@clerk/nextjs/server"
import { format } from "date-fns"
import { GaugeIcon } from "lucide-react"
import Link from "next/link"

import { ResetCountdown } from "@/components/reset-countdown"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Progress, ProgressLabel } from "@/components/ui/progress"
import { getUsage } from "@/lib/usage"

const percent = (used: number, limit: number) =>
  Math.min(100, Math.round((used / limit) * 100))

const compact = new Intl.NumberFormat("en", { notation: "compact" })

const hours = (seconds: number) =>
  (seconds / 3600).toLocaleString("en", { maximumFractionDigits: 1 })

function Meter({
  label,
  used,
  limit,
  detail,
}: {
  label: string
  used: number
  limit: number
  detail: string
}) {
  return (
    <Progress value={percent(used, limit)}>
      <ProgressLabel>{label}</ProgressLabel>
      <span className="ml-auto text-sm text-muted-foreground tabular-nums">
        {detail}
      </span>
    </Progress>
  )
}

// Linked from the user button, not from the sidebar
export default async function Page() {
  const { userId } = await auth.protect()
  const now = new Date()
  const usage = await getUsage(userId, now)

  if (!usage) {
    return (
      <div className="flex min-h-svh flex-col">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <GaugeIcon />
            </EmptyMedia>
            <EmptyTitle>No usage on the free plan</EmptyTitle>
            <EmptyDescription>
              Bots and sandboxes come with Pro, along with a monthly allowance
              of AI and sandbox time.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button nativeButton={false} render={<Link href="/pricing" />}>
              See plans
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    )
  }

  const aiPercent = percent(usage.ai.usedMicros, usage.ai.limitMicros)

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl flex-col justify-center gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Usage</h1>
        <p className="text-muted-foreground">
          What your plan allows from {format(usage.period.start, "MMMM d")} to{" "}
          {format(usage.period.end, "MMMM d")}.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>This period</CardTitle>
          <CardDescription>
            Resets in{" "}
            <ResetCountdown resetsAt={usage.period.end} serverNow={now} />, on{" "}
            {format(usage.period.end, "MMMM d 'at' p")}.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <Meter
            label="AI"
            used={usage.ai.usedMicros}
            limit={usage.ai.limitMicros}
            detail={`${aiPercent}% · ${compact.format(usage.ai.tokens)} tokens`}
          />
          <Meter
            label="Sandbox time"
            used={usage.sandbox.usedSeconds}
            limit={usage.sandbox.limitSeconds}
            detail={`${hours(usage.sandbox.usedSeconds)} of ${hours(usage.sandbox.limitSeconds)} hours`}
          />
          <Meter
            label="Bots"
            used={usage.bots.used}
            limit={usage.bots.limit}
            detail={`${usage.bots.used} of ${usage.bots.limit}`}
          />
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">
        A bot&apos;s sandbox counts as running while it works, for 15 minutes
        after, and while its desktop is open.
      </p>
    </div>
  )
}
