"use server"

import { auth } from "@clerk/nextjs/server"
import { and, eq, inArray, notInArray } from "drizzle-orm"
import { nanoid } from "nanoid"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
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

export async function updateGroupChat(
  chatId: string,
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

  const ownedChat = and(
    eq(chats.id, chatId),
    eq(chats.userId, userId),
    eq(chats.kind, "group")
  )
  const [existing] = await db
    .select({ id: chats.id })
    .from(chats)
    .where(ownedChat)
  if (!existing) throw new Error("Group chat not found")

  // One transaction, so the group never drops below its picked bots.
  // Bots that stay keep their membership row, and with it their place in order.
  const [[chat]] = await db.batch([
    db.update(chats).set({ name }).where(ownedChat).returning(),
    db.delete(chatMembers).where(
      and(
        eq(chatMembers.chatId, chatId),
        notInArray(
          chatMembers.botId,
          owned.map((bot) => bot.id)
        )
      )
    ),
    db
      .insert(chatMembers)
      .values(owned.map((bot) => ({ chatId, botId: bot.id })))
      .onConflictDoNothing(),
  ])

  // The name and faces show in the sidebar and in the chat header
  revalidatePath("/", "layout")

  return { ok: true as const, chat }
}

export async function deleteGroupChat(chatId: string) {
  const { userId } = await auth.protect()

  // Scoped to the owner and to groups; direct chats go with their bot
  const deleted = await db
    .delete(chats)
    .where(
      and(
        eq(chats.id, chatId),
        eq(chats.userId, userId),
        eq(chats.kind, "group")
      )
    )
    .returning({ id: chats.id })

  if (deleted.length === 0) throw new Error("Group chat not found")

  revalidatePath("/", "layout")
  // The page that opened the dialog is the chat that was just deleted
  redirect("/")
}
