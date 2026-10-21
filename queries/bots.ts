import "server-only"

import { auth } from "@clerk/nextjs/server"
import { asc, desc, eq } from "drizzle-orm"

import { db } from "@/db"
import { bots, chatMembers, chats } from "@/db/schema"

// The signed-in user's bots, oldest first
export async function getBots() {
  const { userId } = await auth.protect()

  return db.query.bots.findMany({
    where: eq(bots.userId, userId),
    orderBy: asc(bots.createdAt),
    columns: { id: true, name: true, avatar: true },
  })
}

// The signed-in user's chats, most recent first, each with its bots
export async function getChats() {
  const { userId } = await auth.protect()

  const rows = await db.query.chats.findMany({
    where: eq(chats.userId, userId),
    orderBy: desc(chats.lastMessageAt),
    with: {
      members: {
        orderBy: asc(chatMembers.joinedAt),
        with: { bot: true },
      },
    },
  })

  return rows.map(({ members, ...chat }) => ({
    ...chat,
    bots: members.map((member) => member.bot),
  }))
}

export type ChatListItem = Awaited<ReturnType<typeof getChats>>[number]
