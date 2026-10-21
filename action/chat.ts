"use server"

import { auth as clerkAuth } from "@clerk/nextjs/server"
import { auth } from "@trigger.dev/sdk"
import {
  chat,
  defaultStorage,
  type ChatLoadTranscriptParams,
  type ChatStartSessionParams,
} from "@trigger.dev/sdk/ai"

import { getDesktopUrl } from "@/lib/daytona"
import {
  BOTS,
  type Feature,
  limitMessage,
  PLAN_REQUIRED,
  SANDBOXES,
} from "@/lib/plan"
import { getUsage, sandboxLeft } from "@/lib/usage"
import { getChat } from "@/queries/chats"
import type { chatAgent } from "@/trigger/chat"

const start = chat.createStartSessionAction<typeof chatAgent>("chat")
const load = chat.createLoadTranscriptAction(defaultStorage)

// The chat ID comes from the browser, so each action checks the signed-in user owns it
async function assertChatOwner(chatId: string) {
  const owned = await getChat(chatId)
  if (!owned) throw new Error("Chat not found")
}

async function assertFeatures(...features: Feature[]) {
  const { has } = await clerkAuth.protect()
  if (!features.every((feature) => has({ feature }))) {
    throw new Error(PLAN_REQUIRED)
  }
}

// Reading a transcript stays free; starting a chat is using its bots. The agent
// checks the plan again on every turn, since sessions outlive this call.
export async function startChatSession(
  params: ChatStartSessionParams<typeof chatAgent>
) {
  await assertFeatures(BOTS, SANDBOXES)
  await assertChatOwner(params.chatId)
  return start(params)
}

export async function mintChatAccessToken(chatId: string) {
  await assertChatOwner(chatId)
  return auth.createPublicToken({
    scopes: { read: { sessions: chatId }, write: { sessions: chatId } },
    expirationTime: "1h",
  })
}

export async function loadTranscript(params: ChatLoadTranscriptParams) {
  await assertChatOwner(params.chatId)
  return load(params)
}

// The desktop of the chat's bot, started if its sandbox was stopped. Out of sandbox
// hours it says so instead, since a thrown message doesn't reach the browser.
export async function getChatDesktopUrl(chatId: string) {
  const { userId } = await clerkAuth.protect()
  await assertFeatures(SANDBOXES)
  const chat = await getChat(chatId)
  if (!chat) throw new Error("Chat not found")
  if (chat.kind === "group") throw new Error("Group chats have no desktop")
  const sandboxId = chat.bots[0]?.sandboxId
  if (!sandboxId) throw new Error("Chat has no sandbox")

  const usage = await getUsage(userId)
  if (!usage) throw new Error(PLAN_REQUIRED)
  if (sandboxLeft(usage) <= 0) {
    return {
      ok: false as const,
      limit: limitMessage("sandbox hours", usage.period.end),
    }
  }

  return { ok: true as const, url: await getDesktopUrl(sandboxId) }
}
