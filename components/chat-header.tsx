import { MonitorIcon } from "lucide-react"

import { BotDialog } from "@/components/bot-dialog"
import { ChatAvatar } from "@/components/chat-avatar"
import { Button } from "@/components/ui/button"
import type { ChatDetail } from "@/queries/chats"

export function ChatHeader({ chat }: { chat: ChatDetail }) {
  const name = chat.name ?? chat.bot?.name

  return (
    <header className="flex h-10 shrink-0 items-center justify-between gap-2 px-4">
      {chat.bot ? (
        <BotDialog
          bot={{
            id: chat.bot.id,
            name: chat.bot.name,
            avatar: chat.bot.avatar,
            job: chat.bot.job,
            instructions: chat.bot.instructions,
          }}
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 min-w-0"
            aria-label={`Edit ${chat.bot.name}`}
          >
            <ChatAvatar seed={chat.bot.avatar} className="size-5" />
            <span className="truncate">{name}</span>
          </Button>
        </BotDialog>
      ) : (
        <div className="flex min-w-0 items-center gap-2">
          <ChatAvatar seed={chat.id} className="size-5" />
          <span className="truncate text-sm font-medium">{name}</span>
        </div>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Desktop"
      >
        <MonitorIcon />
      </Button>
    </header>
  )
}
