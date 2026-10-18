import "server-only"

import { auth } from "@clerk/nextjs/server"
import { asc, desc, eq } from "drizzle-orm"

import { db } from "@/db"
import { chatMembers, chats } from "@/db/schema"

// The signed-in user's chats, most recent first, each with its first bot
export async function getChats() {
  const { userId } = await auth.protect()

  const rows = await db.query.chats.findMany({
    where: eq(chats.userId, userId),
    orderBy: desc(chats.lastMessageAt),
    with: {
      members: {
        orderBy: asc(chatMembers.joinedAt),
        limit: 1,
        with: { bot: true },
      },
    },
  })

  return rows.map(({ members, ...chat }) => ({
    ...chat,
    bot: members[0]?.bot ?? null,
  }))
}

export type ChatListItem = Awaited<ReturnType<typeof getChats>>[number]
