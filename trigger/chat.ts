import { anthropic } from "@ai-sdk/anthropic"
import { google } from "@ai-sdk/google"
import { chat } from "@trigger.dev/sdk/ai"
import { APICallError, stepCountIs } from "ai"
import { and, asc, eq } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db"
import { type Bot, type Chat, chatMembers } from "@/db/schema"
import { forgetStartedSandboxes } from "@/lib/daytona"
import { botSandbox, type ChatUIMessage, tools } from "@/trigger/tools"

// AI_PROVIDER=google uses Gemini (free tier, GOOGLE_GENERATIVE_AI_API_KEY);
// anything else uses Claude (ANTHROPIC_API_KEY)
function chatModel() {
  return process.env.AI_PROVIDER === "google"
    ? google("gemini-flash-latest")
    : anthropic("claude-sonnet-5-5")
}

// The member answering this turn: the bot picked in the composer, or the chat's first one.
// Matching on the chat too means the browser can only pick a bot that's in it.
async function getTurnMember(chatId: string, botId?: string) {
  const member = await db.query.chatMembers.findFirst({
    where: botId
      ? and(eq(chatMembers.chatId, chatId), eq(chatMembers.botId, botId))
      : eq(chatMembers.chatId, chatId),
    orderBy: asc(chatMembers.joinedAt),
    with: { bot: true, chat: true },
  })
  if (!member) throw new Error(`No bot ${botId ?? ""} in chat ${chatId}`)
  return member
}

function systemPrompt(bot: Bot, room: Chat) {
  return [
    `You are ${bot.name}, an AI teammate. Your job: ${bot.job}.`,
    "You work alongside the person you're chatting with as a member of their team. " +
      "Stay in role, keep your job in focus, and talk like a capable colleague, not a generic assistant.",
    room.kind === "group" &&
      `This is a group chat, "${room.name}", shared with other AI teammates. ` +
        "Earlier assistant replies may be theirs, not yours.",
    bot.instructions &&
      `How to go about your job, in the words of the person who set you up:\n${bot.instructions}`,
    "You have your own sandbox: an isolated Linux computer with its own filesystem " +
      "and a 1024x768 desktop, provisioned for you alone and kept for as long as you exist. " +
      "Nothing in it is shared with other teammates. Use your tools to work in it: " +
      "run commands and handle files directly when you can, and use the desktop when a task needs a GUI. " +
      "On the desktop, look at the screen before you act and again afterwards to check what happened.",
  ]
    .filter(Boolean)
    .join("\n\n")
}

// Transcripts persist in the platform's default storage, keyed by chat ID
export const chatAgent = chat
  .withUIMessage<ChatUIMessage>({
    streamOptions: {
      // Forward provider errors (e.g. low credit balance) instead of the masked default.
      onError: (error) =>
        APICallError.isInstance(error)
          ? error.message
          : "Something went wrong. Please try again.",
    },
  })
  .agent({
    id: "chat",
    // The bot picked in the composer, sent with every turn through the transport
    clientDataSchema: z.object({ botId: z.string().optional() }),
    // Declared here too, so screenshots stay images when history is re-converted
    tools,
    // A group chat can switch bots between turns, so the prompt and sandbox are set per turn
    onTurnStart: async ({ chatId, clientData }) => {
      forgetStartedSandboxes()
      const { bot, chat: room } = await getTurnMember(chatId, clientData?.botId)
      if (!bot.sandboxId) throw new Error(`Bot ${bot.id} has no sandbox`)
      botSandbox.init({ sandboxId: bot.sandboxId })
      chat.prompt.set(systemPrompt(bot, room))
    },
    run: async ({ messages, tools, signal, streamText }) =>
      streamText({
        model: chatModel(),
        messages,
        tools,
        abortSignal: signal,
        // Computer use takes many small steps
        stopWhen: stepCountIs(50),
      }),
  })
