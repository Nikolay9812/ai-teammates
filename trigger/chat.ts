import { anthropic } from "@ai-sdk/anthropic"
import { chat } from "@trigger.dev/sdk/ai"
import { APICallError, stepCountIs } from "ai"
import { asc, eq } from "drizzle-orm"

import { db } from "@/db"
import { type Bot, chatMembers } from "@/db/schema"
import { forgetStartedSandboxes } from "@/lib/daytona"
import { botSandbox, type ChatUIMessage, tools } from "@/trigger/tools"

// The bot that answers in a chat: its first member, as in the chat header
async function getChatBot(chatId: string) {
  const member = await db.query.chatMembers.findFirst({
    where: eq(chatMembers.chatId, chatId),
    orderBy: asc(chatMembers.joinedAt),
    with: { bot: true },
  })
  if (!member) throw new Error(`No bot in chat ${chatId}`)
  return member.bot
}

function systemPrompt(bot: Bot) {
  return [
    `You are ${bot.name}, an AI teammate. Your job: ${bot.job}.`,
    "You work alongside the person you're chatting with as a member of their team. " +
      "Stay in role, keep your job in focus, and talk like a capable colleague, not a generic assistant.",
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
    // Declared here too, so screenshots stay images when history is re-converted
    tools,
    // The prompt and locals are run-scoped, so set them on every fresh worker, continuations included
    onBoot: async ({ chatId }) => {
      const bot = await getChatBot(chatId)
      if (!bot.sandboxId) throw new Error(`Bot ${bot.id} has no sandbox`)
      botSandbox.init({ sandboxId: bot.sandboxId })
      chat.prompt.set(systemPrompt(bot))
    },
    onTurnStart: () => forgetStartedSandboxes(),
    run: async ({ messages, tools, signal, streamText }) =>
      streamText({
        model: anthropic("claude-sonnet-5-5"),
        messages,
        tools,
        abortSignal: signal,
        // Computer use takes many small steps
        stopWhen: stepCountIs(50),
      }),
  })
