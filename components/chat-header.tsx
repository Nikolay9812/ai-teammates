import { BotDialog } from "@/components/bot-dialog"
import { ChatAvatar } from "@/components/chat-avatar"
import { DesktopPanelToggle } from "@/components/desktop-panel"
import { GroupChatAvatar } from "@/components/group-chat-avatar"
import { GroupChatDialog } from "@/components/group-chat-dialog"
import { Button } from "@/components/ui/button"
import { getBots } from "@/queries/bots"
import type { ChatDetail } from "@/queries/chats"

export async function ChatHeader({ chat }: { chat: ChatDetail }) {
  const bot = chat.kind === "direct" ? chat.bots[0] : undefined
  const name = chat.name ?? bot?.name
  // A group's edit dialog offers every bot as a member
  const allBots = chat.kind === "group" ? await getBots() : []

  return (
    <header className="flex h-10 shrink-0 items-center justify-between gap-2 px-4">
      {bot ? (
        <BotDialog
          bot={{
            id: bot.id,
            name: bot.name,
            avatar: bot.avatar,
            job: bot.job,
            instructions: bot.instructions,
          }}
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 min-w-0"
            aria-label={`Edit ${bot.name}`}
          >
            <ChatAvatar seed={bot.avatar} className="size-5" />
            <span className="truncate">{name}</span>
          </Button>
        </BotDialog>
      ) : chat.kind === "group" ? (
        <GroupChatDialog
          bots={allBots}
          chat={{
            id: chat.id,
            name: chat.name ?? "",
            botIds: chat.bots.map((member) => member.id),
          }}
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 min-w-0"
            aria-label={`Edit ${name}`}
          >
            <GroupChatAvatar
              seeds={chat.bots.map((member) => member.avatar)}
              className="size-5"
            />
            <span className="truncate">{name}</span>
          </Button>
        </GroupChatDialog>
      ) : (
        <div className="flex min-w-0 items-center gap-2">
          <ChatAvatar seed={chat.id} className="size-5" />
          <span className="truncate text-sm font-medium">{name}</span>
        </div>
      )}
      {/* Each bot has its own desktop, so a group has no single one to show */}
      {bot && <DesktopPanelToggle />}
    </header>
  )
}
