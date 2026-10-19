"use client"

import Link from "next/link"
import { useParams } from "next/navigation"

import { SidebarMenuButton } from "@/components/ui/sidebar"

export function ChatMenuButton({
  chatId,
  ...props
}: Omit<React.ComponentProps<typeof SidebarMenuButton>, "render" | "isActive"> & {
  chatId: string
}) {
  const params = useParams<{ chatId?: string }>()

  return (
    <SidebarMenuButton
      isActive={params.chatId === chatId}
      render={<Link href={`/chats/${chatId}`} />}
      {...props}
    />
  )
}
