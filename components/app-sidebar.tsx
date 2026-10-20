import { UserButton } from "@clerk/nextjs"
import { formatDistanceToNowStrict } from "date-fns"

import { ChatAvatar } from "@/components/chat-avatar"
import { ChatMenuButton } from "@/components/chat-menu-button"
import { CreateMenu } from "@/components/create-menu"
import { SearchCommand, SearchCommandItem } from "@/components/search-command"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { getChats } from "@/queries/bots"

export async function AppSidebar() {
  const chats = await getChats()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex justify-end">
          <CreateMenu />
        </div>
        <SearchCommand>
          {chats.map((chat) => {
            const name = chat.name ?? chat.bot?.name ?? ""

            return (
              <SearchCommandItem
                key={chat.id}
                href={`/chats/${chat.id}`}
                value={chat.id}
                keywords={[name]}
              >
                <ChatAvatar
                  seed={chat.bot?.avatar ?? chat.id}
                  className="size-6"
                />
                <span className="truncate">{name}</span>
              </SearchCommandItem>
            )
          })}
        </SearchCommand>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {chats.map((chat) => (
                <SidebarMenuItem key={chat.id}>
                  <ChatMenuButton
                    chatId={chat.id}
                    size="lg"
                    className="h-auto group-data-[collapsible=icon]:p-1!"
                    tooltip={chat.name ?? chat.bot?.name ?? undefined}
                  >
                    <ChatAvatar
                      seed={chat.bot?.avatar ?? chat.id}
                      className="group-data-[collapsible=icon]:size-6"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-medium">
                          {chat.name ?? chat.bot?.name}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatDistanceToNowStrict(chat.lastMessageAt)}
                        </span>
                      </div>
                      {chat.lastMessagePreview && (
                        <span className="truncate text-xs text-muted-foreground">
                          {chat.lastMessagePreview}
                        </span>
                      )}
                    </div>
                  </ChatMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<div />}
              className="p-0 *:size-full group-data-[collapsible=icon]:p-0!"
            >
              <UserButton
                showName
                appearance={{
                  elements: {
                    rootBox: "flex size-full",
                    userButtonTrigger:
                      "flex size-full items-center rounded-md p-2 text-inherit ring-sidebar-ring outline-hidden focus-visible:ring-2 group-data-[collapsible=icon]:p-1",
                    userButtonBox:
                      "w-full min-w-0 flex-row-reverse justify-end gap-2",
                    userButtonOuterIdentifier:
                      "truncate ps-0 text-sm font-normal text-inherit group-data-[collapsible=icon]:hidden",
                    userButtonAvatarBox:
                      "size-8 shrink-0 group-data-[collapsible=icon]:size-6",
                  },
                }}
              />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
