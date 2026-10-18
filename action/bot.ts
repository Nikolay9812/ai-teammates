"use server"

import { auth } from "@clerk/nextjs/server"
import { nanoid } from "nanoid"
import { revalidatePath } from "next/cache"
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
