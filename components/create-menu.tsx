"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { PlusIcon, UsersIcon } from "lucide-react"

import { BotDialog } from "@/components/bot-dialog"
import { GroupChatDialog } from "@/components/group-chat-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Bot } from "@/db/schema"

function CreateMenu({ bots }: { bots: Pick<Bot, "id" | "name" | "avatar">[] }) {
  // The dialogs live outside the menu, so they survive the menu closing
  const [botDialog] = React.useState(() => DialogPrimitive.createHandle())
  const [groupChatDialog] = React.useState(() => DialogPrimitive.createHandle())

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon" aria-label="Create" />}
        >
          <PlusIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => botDialog.open(null)}>
            <PlusIcon />
            Create new bot
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => groupChatDialog.open(null)}>
            <UsersIcon />
            Create group chat
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <BotDialog handle={botDialog} />
      <GroupChatDialog handle={groupChatDialog} bots={bots} />
    </>
  )
}

export { CreateMenu }
