"use server"

import { auth } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { db } from "@/db"
import { bots, insertBotSchema } from "@/db/schema"

export async function createBot(input: z.input<typeof insertBotSchema>) {
  const { userId } = await auth.protect()

  const parsed = insertBotSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false as const,
      errors: z.flattenError(parsed.error).fieldErrors,
    }
  }

  const [bot] = await db
    .insert(bots)
    .values({
      ...parsed.data,
      // Store blank instructions as null
      instructions: parsed.data.instructions || null,
      userId,
    })
    .returning()

  revalidatePath("/")

  return { ok: true as const, bot }
}
