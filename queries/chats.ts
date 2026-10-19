import "server-only"

import { auth } from "@clerk/nextjs/server"
import { and, asc, eq } from "drizzle-orm"

import { db } from "@/db"
import { chatMembers, chats } from "@/db/schema"

// One of the signed-in user's chats with its first bot, or null if it isn't theirs
export async function getChat(chatId: string) {
  const { userId } = await auth.protect()

  const row = await db.query.chats.findFirst({
    where: and(eq(chats.id, chatId), eq(chats.userId, userId)),
    with: {
      members: {
        orderBy: asc(chatMembers.joinedAt),
        limit: 1,
        with: { bot: true },
      },
    },
  })

  if (!row) return null

  const { members, ...chat } = row
  return { ...chat, bot: members[0]?.bot ?? null }
}

export type ChatDetail = NonNullable<Awaited<ReturnType<typeof getChat>>>
