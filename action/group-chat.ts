"use server"

import { auth } from "@clerk/nextjs/server"
import { and, eq, inArray } from "drizzle-orm"
import { nanoid } from "nanoid"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { db } from "@/db"
import { bots, chatMembers, chats, insertGroupChatSchema } from "@/db/schema"

export async function createGroupChat(
  input: z.input<typeof insertGroupChatSchema>
) {
  const { userId } = await auth.protect()

  const parsed = insertGroupChatSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false as const,
      errors: z.flattenError(parsed.error).fieldErrors,
    }
  }

  const { name, botIds } = parsed.data

  // Scoped to the owner, so another user's bot IDs match nothing
  const owned = await db
    .select({ id: bots.id })
    .from(bots)
    .where(and(eq(bots.userId, userId), inArray(bots.id, botIds)))
  if (owned.length !== new Set(botIds).size) throw new Error("Bot not found")

  // Set here so the batched inserts can reference it
  const chatId = nanoid()

  // A batch runs as one transaction, so the chat never exists without its bots
  const [[chat]] = await db.batch([
    db
      .insert(chats)
      .values({ id: chatId, userId, kind: "group", name })
      .returning(),
    db
      .insert(chatMembers)
      .values(owned.map((bot) => ({ chatId, botId: bot.id }))),
  ])

  revalidatePath("/")

  return { ok: true as const, chat }
}
