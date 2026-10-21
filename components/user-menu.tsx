"use client"

import { UserButton } from "@clerk/nextjs"
import { GaugeIcon } from "lucide-react"

// The sidebar's account button. A client component, since a server component can't
// reach UserButton.Link and the other compound parts.
export function UserMenu() {
  return (
    <UserButton
      showName
      appearance={{
        elements: {
          rootBox: "flex size-full",
          userButtonTrigger:
            "flex size-full items-center rounded-md p-2 text-inherit ring-sidebar-ring outline-hidden focus-visible:ring-2 group-data-[collapsible=icon]:p-1",
          userButtonBox: "w-full min-w-0 flex-row-reverse justify-end gap-2",
          userButtonOuterIdentifier:
            "truncate ps-0 text-sm font-normal text-inherit group-data-[collapsible=icon]:hidden",
          userButtonAvatarBox:
            "size-8 shrink-0 group-data-[collapsible=icon]:size-6",
        },
      }}
    >
      <UserButton.MenuItems>
        <UserButton.Link
          label="Usage"
          labelIcon={<GaugeIcon className="size-4" />}
          href="/usage"
        />
      </UserButton.MenuItems>
    </UserButton>
  )
}
