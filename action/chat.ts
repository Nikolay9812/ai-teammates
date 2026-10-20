"use server"

import { auth } from "@trigger.dev/sdk"
import {
  chat,
  defaultStorage,
  type ChatLoadTranscriptParams,
  type ChatStartSessionParams,
} from "@trigger.dev/sdk/ai"

import { getDesktopUrl } from "@/lib/daytona"
import { getChat } from "@/queries/chats"
import type { chatAgent } from "@/trigger/chat"

const start = chat.createStartSessionAction<typeof chatAgent>("chat")
const load = chat.createLoadTranscriptAction(defaultStorage)

// The chat ID comes from the browser, so each action checks the signed-in user owns it
async function assertChatOwner(chatId: string) {
  const owned = await getChat(chatId)
  if (!owned) throw new Error("Chat not found")
}

export async function startChatSession(
  params: ChatStartSessionParams<typeof chatAgent>
) {
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

// The desktop of the chat's bot, started if its sandbox was stopped
export async function getChatDesktopUrl(chatId: string) {
  const chat = await getChat(chatId)
  if (!chat) throw new Error("Chat not found")
  if (!chat.bot?.sandboxId) throw new Error("Chat has no sandbox")
  return getDesktopUrl(chat.bot.sandboxId)
}
