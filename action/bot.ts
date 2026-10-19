"use server"

import { auth } from "@clerk/nextjs/server"
import { and, eq, inArray } from "drizzle-orm"
import { nanoid } from "nanoid"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { db } from "@/db"
import { bots, chatMembers, chats, insertBotSchema } from "@/db/schema"

export async function createBot(input: z.input<typeof insertBotSchema>) {
  const { userId } = await auth.protect()

  const parsed = insertBotSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false as const,
      errors: z.flattenError(parsed.error).fieldErrors,
    }
  }

  // IDs are set here so the batched inserts can reference each other
  const botId = nanoid()
  const chatId = nanoid()

  // A batch runs as one transaction, so the bot never exists without its chat
  const [[bot], [chat]] = await db.batch([
    db
      .insert(bots)
      .values({
        ...parsed.data,
        id: botId,
        // Store blank instructions as null
        instructions: parsed.data.instructions || null,
        userId,
      })
      .returning(),
    db
      .insert(chats)
      .values({ id: chatId, userId, kind: "direct" })
      .returning(),
    db.insert(chatMembers).values({ chatId, botId }),
  ])

  revalidatePath("/")

  return { ok: true as const, bot, chat }
}

export async function updateBot(
  botId: string,
  input: z.input<typeof insertBotSchema>
) {
  const { userId } = await auth.protect()

  const parsed = insertBotSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false as const,
      errors: z.flattenError(parsed.error).fieldErrors,
    }
  }

  // Scoped to the owner, so another user's bot ID matches nothing
  const [bot] = await db
    .update(bots)
    .set({
      ...parsed.data,
      // Store blank instructions as null
      instructions: parsed.data.instructions || null,
    })
    .where(and(eq(bots.id, botId), eq(bots.userId, userId)))
    .returning()

  if (!bot) throw new Error("Bot not found")

  // The name and face show in the sidebar and in every chat header
  revalidatePath("/", "layout")

  return { ok: true as const, bot }
}

export async function deleteBot(botId: string) {
  const { userId } = await auth.protect()

  // Direct chats only make sense with their bot, so they go too
  const directChatIds = db
    .select({ id: chatMembers.chatId })
    .from(chatMembers)
    .innerJoin(chats, eq(chats.id, chatMembers.chatId))
    .where(and(eq(chatMembers.botId, botId), eq(chats.kind, "direct")))

  // Both deletes are scoped to the owner, and memberships cascade
  const [, deleted] = await db.batch([
    db
      .delete(chats)
      .where(and(eq(chats.userId, userId), inArray(chats.id, directChatIds))),
    db
      .delete(bots)
      .where(and(eq(bots.id, botId), eq(bots.userId, userId)))
      .returning({ id: bots.id }),
  ])

  if (deleted.length === 0) throw new Error("Bot not found")

  revalidatePath("/", "layout")
  // The page that opened the dialog may be the chat that was just deleted
  redirect("/")
}
