import { notFound } from "next/navigation"

import { Chat } from "@/components/chat"
import { ChatHeader } from "@/components/chat-header"
import { DesktopPanel, DesktopPanelProvider } from "@/components/desktop-panel"
import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { getChat } from "@/queries/chats"

export default async function Page(props: PageProps<"/chats/[chatId]">) {
  const { chatId } = await props.params
  const chat = await getChat(chatId)

  if (!chat) notFound()

  return (
    <DesktopPanelProvider key={chat.id} chatId={chat.id}>
      {/* The group sets an inline height of 100%, so it needs a parent of fixed height */}
      <div className="h-svh">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel id="chat" minSize="25" className="flex flex-col">
            <ChatHeader chat={chat} />
            <Chat key={chat.id} chatId={chat.id} />
          </ResizablePanel>
          <DesktopPanel name={chat.bot?.name ?? chat.name ?? "Bot"} />
        </ResizablePanelGroup>
      </div>
    </DesktopPanelProvider>
  )
}
