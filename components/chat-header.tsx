import { BotDialog } from "@/components/bot-dialog"
import { ChatAvatar } from "@/components/chat-avatar"
import { DesktopPanelToggle } from "@/components/desktop-panel"
import { GroupChatAvatar } from "@/components/group-chat-avatar"
import { Button } from "@/components/ui/button"
import type { ChatDetail } from "@/queries/chats"

export function ChatHeader({ chat }: { chat: ChatDetail }) {
  const bot = chat.kind === "direct" ? chat.bots[0] : undefined
  const name = chat.name ?? bot?.name

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
      ) : (
        <div className="flex min-w-0 items-center gap-2">
          {chat.kind === "group" ? (
            <GroupChatAvatar
              seeds={chat.bots.map((member) => member.avatar)}
              className="size-5"
            />
          ) : (
            <ChatAvatar seed={chat.id} className="size-5" />
          )}
          <span className="truncate text-sm font-medium">{name}</span>
        </div>
      )}
      {/* Each bot has its own desktop, so a group has no single one to show */}
      {bot && <DesktopPanelToggle />}
    </header>
  )
}
