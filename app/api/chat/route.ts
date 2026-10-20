import { anthropic } from "@ai-sdk/anthropic"
import { auth } from "@clerk/nextjs/server"
import {
  APICallError,
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai"

export async function POST(req: Request) {
  await auth.protect()

  const { messages }: { messages: UIMessage[] } = await req.json()

  const result = streamText({
    model: anthropic("claude-sonnet-5-5"),
    messages: await convertToModelMessages(messages),
  })

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      // Forward provider errors (e.g. low credit balance) instead of the masked default.
      onError: (error) =>
        APICallError.isInstance(error)
          ? error.message
          : "Something went wrong. Please try again.",
    }),
  })
}
