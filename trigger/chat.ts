import { anthropic } from "@ai-sdk/anthropic"
import { chat } from "@trigger.dev/sdk/ai"
import { APICallError } from "ai"

// Transcripts persist in the platform's default storage, keyed by chat ID
export const chatAgent = chat.agent({
  id: "chat",
  uiMessageStreamOptions: {
    // Forward provider errors (e.g. low credit balance) instead of the masked default.
    onError: (error) =>
      APICallError.isInstance(error)
        ? error.message
        : "Something went wrong. Please try again.",
  },
  run: async ({ messages, signal, streamText }) =>
    streamText({
      model: anthropic("claude-sonnet-5-5"),
      messages,
      abortSignal: signal,
    }),
})
