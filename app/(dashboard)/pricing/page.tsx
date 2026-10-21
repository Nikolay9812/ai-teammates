import { PricingTable } from "@clerk/nextjs"
import { auth } from "@clerk/nextjs/server"

// Linked from the upgrade toast only, not from the sidebar
export default async function Page() {
  await auth.protect()

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-4xl flex-col justify-center gap-8 p-6">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Put your teammates to work
        </h1>
        <p className="text-muted-foreground">
          Pro unlocks bots and the sandboxes they work in: their own computer,
          files, desktop, and memory.
        </p>
      </div>
      <PricingTable />
    </div>
  )
}
