import { anthropic } from "@ai-sdk/anthropic"
import { google } from "@ai-sdk/google"
import { chat } from "@trigger.dev/sdk/ai"
import { APICallError, stepCountIs } from "ai"
import { asc, eq } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/db"
import { type Bot, type Chat, chatMembers, chats } from "@/db/schema"
import { forgetStartedSandboxes } from "@/lib/daytona"
import {
  type ChatUIMessage,
  handedOff,
  type Teammate,
  tools,
  turnBot,
} from "@/trigger/tools"

// AI_PROVIDER=google uses Gemini (free tier, GOOGLE_GENERATIVE_AI_API_KEY);
// anything else uses Claude (ANTHROPIC_API_KEY).
// Flash-lite, because free-tier flash requests queue for over a minute each.
function chatModel() {
  return process.env.AI_PROVIDER === "google"
    ? google("gemini-flash-lite-latest")
    : anthropic("claude-sonnet-5-5")
}

// The chat with its bots, and the one answering this turn: the bot picked in the
// composer, or the chat's first one. Only the chat's own bots can be picked.
async function getTurnContext(chatId: string, botId?: string) {
  const room = await db.query.chats.findFirst({
    where: eq(chats.id, chatId),
    with: {
      members: { orderBy: asc(chatMembers.joinedAt), with: { bot: true } },
    },
  })
  if (!room) throw new Error(`Chat ${chatId} not found`)

  const members = room.members.map((member) => member.bot)
  const bot = botId ? members.find((member) => member.id === botId) : members[0]
  if (!bot) throw new Error(`No bot ${botId ?? ""} in chat ${chatId}`)
  return { room, bot, members }
}

const TOOLS_GUIDE =
  "Your tools: bash runs shell commands; readFile, writeFile and listFiles handle files; " +
  "viewScreen lets you look at your desktop, and showScreen also shows the screenshot to the user; " +
  "click, moveMouse, scroll, pressKey and typeText drive the desktop."

function groupPrompt(room: Chat, teammates: Teammate[], canHandOff: boolean) {
  const roster = teammates
    .map(
      (teammate) => `- ${teammate.name} (ID ${teammate.id}): ${teammate.job}`
    )
    .join("\n")

  return [
    `This is a group chat, "${room.name}", where the user works with you and other AI teammates. ` +
      "The user picks who answers each message, and this time it's you.",
    "Each assistant reply in the history was written by whichever teammate answered it, " +
      "so earlier replies, tool calls included, may be a teammate's rather than yours. " +
      "Every teammate has their own sandbox: files and screens a teammate mentions are on their computer, not yours.",
    `Your teammates here:\n${roster}`,
    canHandOff
      ? "If the user's latest request plainly belongs to a teammate's job more than yours, " +
        "say so in a sentence and call handoff with their ID instead of doing the work. " +
        "They answer right after you. Don't hand off what you can do well, " +
        "and don't hand off just to get a teammate's opinion."
      : "A teammate has just handed the user's latest request to you, so it's yours now: " +
        "pick it up and see it through. You can't hand it on.",
  ].join("\n\n")
}

function systemPrompt(
  bot: Bot,
  room: Chat,
  teammates: Teammate[],
  canHandOff: boolean
) {
  return [
    `You are ${bot.name}, an AI teammate. Your job: ${bot.job}.`,
    "You work alongside the person you're chatting with as a member of their team. " +
      "Stay in role, keep your job in focus, and talk like a capable colleague, not a generic assistant.",
    room.kind === "group" && groupPrompt(room, teammates, canHandOff),
    bot.instructions &&
      `How to go about your job, in the words of the person who set you up:\n${bot.instructions}`,
    "You have your own sandbox: an isolated Linux computer with its own filesystem " +
      "and a 1024x768 desktop, provisioned for you alone and kept for as long as you exist. " +
      "Nothing in it is shared with other teammates. Use your tools to work in it: " +
      "run commands and handle files directly when you can, and use the desktop when a task needs a GUI. " +
      "On the desktop, look at the screen before you act and again afterwards to check what happened.",
    TOOLS_GUIDE,
  ]
    .filter(Boolean)
    .join("\n\n")
}

// The teammate a handoff action asked for, answered by the turn that follows it
const pendingHandoff = chat.local<{ botId: string | null }>({
  id: "pendingHandoff",
})

// Every tool but handoff, for turns with nobody to hand off to
const soloTools = (Object.keys(tools) as (keyof typeof tools)[]).filter(
  (name) => name !== "handoff"
)

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
    // Sent by the browser once a reply ends in a handoff, so the teammate answers next
    actionSchema: z.object({ type: z.literal("handoff"), botId: z.string() }),
    // Declared here too, so screenshots stay images when history is re-converted
    tools,
    onBoot: () => pendingHandoff.init({ botId: null }),
    onAction: ({ action }) => {
      pendingHandoff.botId = action.botId
      // No new user message: the teammate answers the request that was handed over
      return chat.turn()
    },
    // A group chat can switch bots between turns, so the prompt and sandbox are set per turn
    onTurnStart: async ({ chatId, clientData }) => {
      forgetStartedSandboxes()

      const handoffTo = pendingHandoff.botId
      pendingHandoff.botId = null

      const { room, bot, members } = await getTurnContext(
        chatId,
        handoffTo ?? clientData?.botId
      )
      if (!bot.sandboxId) throw new Error(`Bot ${bot.id} has no sandbox`)

      const teammates = members
        .filter((member) => member.id !== bot.id)
        .map(({ id, name, job }) => ({ id, name, job }))
      // A handed-off turn can't hand on, so two bots can't pass a request back and forth
      const canHandOff = room.kind === "group" && !handoffTo

      turnBot.init({
        botId: bot.id,
        sandboxId: bot.sandboxId,
        teammates: canHandOff ? teammates : [],
      })
      chat.prompt.set(systemPrompt(bot, room, teammates, canHandOff))
      chat.setUIMessageStreamOptions({
        messageMetadata: () => ({ botId: bot.id }),
      })
    },
    run: async ({ messages, tools, signal, streamText }) =>
      streamText({
        model: chatModel(),
        messages,
        tools,
        activeTools: turnBot.teammates.length > 0 ? undefined : soloTools,
        abortSignal: signal,
        // Computer use takes many small steps, and a handoff ends the reply
        stopWhen: [stepCountIs(50), handedOff],
      }),
  })
