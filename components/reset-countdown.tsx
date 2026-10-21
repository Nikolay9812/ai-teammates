"use client"

import { intervalToDuration } from "date-fns"
import { useEffect, useState } from "react"

// Time left until the allowance resets, ticking every minute. Starts from the server's
// clock so the first render matches the server markup.
export function ResetCountdown({
  resetsAt,
  serverNow,
}: {
  resetsAt: Date
  serverNow: Date
}) {
  const [now, setNow] = useState(serverNow)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  if (now >= resetsAt) return <>any moment now</>

  const {
    months = 0,
    days = 0,
    hours = 0,
    minutes = 0,
  } = intervalToDuration({
    start: now,
    end: resetsAt,
  })
  const parts = [
    months && `${months}mo`,
    days && `${days}d`,
    `${hours}h`,
    `${minutes}m`,
  ].filter(Boolean)

  return <span className="tabular-nums">{parts.join(" ")}</span>
}
