import "server-only"

import { Daytona, DaytonaNotFoundError, type Sandbox } from "@daytona/sdk"

// Reads DAYTONA_API_KEY from the environment. The endpoint is passed explicitly because the
// SDK refuses to pick up DAYTONA_API_URL when it also sits in a .env file in the working
// directory, which is how `trigger dev` loads .env.local.
export const daytona = new Daytona({
  apiUrl: process.env.DAYTONA_API_URL ?? "https://app.daytona.io/api",
})

// Each bot gets its own sandbox. Labels tie it back to the bot in the dashboard.
export async function createBotSandbox(botId: string, userId: string) {
  const sandbox = await daytona.create({ labels: { botId, userId } })
  return sandbox.id
}

export async function deleteBotSandbox(sandboxId: string) {
  try {
    const sandbox = await daytona.get(sandboxId)
    await daytona.delete(sandbox)
  } catch (error) {
    // Already gone, so there is nothing left to clean up
    if (error instanceof DaytonaNotFoundError) return
    throw error
  }
}

// Started sandboxes and desktops, cached so each tool call doesn't re-check
const sandboxes = new Map<string, Promise<Sandbox>>()
const desktops = new Map<string, Promise<Sandbox>>()

// Sandboxes auto-stop when idle, so a cached one can go stale between turns
export function forgetStartedSandboxes() {
  sandboxes.clear()
  desktops.clear()
}

function once(
  cache: Map<string, Promise<Sandbox>>,
  sandboxId: string,
  load: () => Promise<Sandbox>
) {
  let pending = cache.get(sandboxId)
  if (!pending) {
    pending = load()
    // Let the next call retry instead of reusing a failure
    pending.catch(() => cache.delete(sandboxId))
    cache.set(sandboxId, pending)
  }
  return pending
}

// The sandbox, started if it was stopped
export function getStartedSandbox(sandboxId: string) {
  return once(sandboxes, sandboxId, async () => {
    const sandbox = await daytona.get(sandboxId)
    if (sandbox.state !== "started") await sandbox.start()
    return sandbox
  })
}

// The sandbox with its desktop (Xvfb, xfce4, VNC) running
export function getDesktopSandbox(sandboxId: string) {
  return once(desktops, sandboxId, async () => {
    const sandbox = await getStartedSandbox(sandboxId)
    const { status } = await sandbox.computerUse.getStatus()
    if (status !== "active") await sandbox.computerUse.start()
    return sandbox
  })
}

// noVNC serves the desktop on this port
const VNC_PORT = 6080

// A signed noVNC URL for the sandbox desktop that a browser can load in an iframe
export async function getDesktopUrl(sandboxId: string) {
  // The browser can come back long after the sandbox auto-stopped, so check it again
  sandboxes.delete(sandboxId)
  desktops.delete(sandboxId)
  const sandbox = await getDesktopSandbox(sandboxId)

  const { url } = await sandbox.getSignedPreviewUrl(VNC_PORT, 3600)
  const desktopUrl = new URL("/vnc.html", url)
  desktopUrl.searchParams.set("autoconnect", "true")
  desktopUrl.searchParams.set("reconnect", "true")
  desktopUrl.searchParams.set("resize", "scale")
  return desktopUrl.toString()
}
