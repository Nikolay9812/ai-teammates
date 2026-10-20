"use client"

import { useChat } from "@ai-sdk/react"
import type { TriggerChatTransport } from "@trigger.dev/sdk/chat"
import {
  type InferChatUIMessage,
  useLoadTranscript,
  useTriggerChatTransport,
} from "@trigger.dev/sdk/chat/react"
import {
  CircleAlertIcon,
  EyeIcon,
  FilePenIcon,
  FileTextIcon,
  FolderOpenIcon,
  KeyboardIcon,
  MonitorIcon,
  MouseIcon,
  MousePointer2Icon,
  MousePointerClickIcon,
  SquareTerminalIcon,
  TypeIcon,
  type LucideIcon,
} from "lucide-react"
import { useCallback } from "react"

import {
  loadTranscript,
  mintChatAccessToken,
  startChatSession,
} from "@/action/chat"

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import { Image } from "@/components/ai-elements/image"
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { CodeBlock, CodeBlockContent } from "@/components/ui/code-block"
import { Spinner } from "@/components/ui/spinner"
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace"
import type { chatAgent } from "@/trigger/chat"

type ChatMessage = InferChatUIMessage<typeof chatAgent>
type Part = ChatMessage["parts"][number]
type ToolPart = Extract<Part, { type: `tool-${string}` }>

export function Chat({ chatId }: { chatId: string }) {
  const transport = useTriggerChatTransport<typeof chatAgent>({
    task: "chat",
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    startSession: ({ chatId, clientData }) =>
      startChatSession({ chatId, clientData }),
  })
  const { messages, isLoading } = useLoadTranscript(chatId, loadTranscript, {
    transport,
  })

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <ChatView
      chatId={chatId}
      // The transcript holds what the agent streamed, so it has the agent's parts
      initialMessages={messages as ChatMessage[]}
      transport={transport}
    />
  )
}

// Mounted after the transcript loads, since useChat only reads its initial messages once
function ChatView({
  chatId,
  initialMessages,
  transport,
}: {
  chatId: string
  initialMessages: ChatMessage[]
  transport: TriggerChatTransport
}) {
  const {
    messages,
    sendMessage,
    status,
    stop: stopLocal,
    error,
    regenerate,
  } = useChat<ChatMessage>({
    id: chatId,
    messages: initialMessages,
    transport,
    // Reconnect to an answer still streaming from before a reload
    resume: initialMessages.length > 0,
  })

  // useChat's stop doesn't reach the agent after a resume, so stop it directly too
  const stop = useCallback(() => {
    stopLocal()
    transport.stopGeneration(chatId)
  }, [stopLocal, transport, chatId])

  function handleSubmit(message: PromptInputMessage) {
    if (!message.text.trim()) return
    sendMessage({ text: message.text })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation>
        <ConversationContent className="mx-auto w-full max-w-3xl">
          {messages.length === 0 ? (
            <ConversationEmptyState
              title="Start a conversation"
              description="Send a message to begin chatting"
            />
          ) : (
            messages.map((message) => (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  {groupParts(message.parts).map((block) => {
                    const key = `${message.id}-${block.index}`
                    switch (block.kind) {
                      case "text":
                        return (
                          <MessageResponse key={key}>
                            {block.text}
                          </MessageResponse>
                        )
                      case "tools":
                        return (
                          <Trace key={key}>
                            {block.parts.map((part) => (
                              <ToolRow key={part.toolCallId} part={part} />
                            ))}
                          </Trace>
                        )
                      case "screen":
                        return (
                          <Image
                            key={key}
                            base64={block.base64}
                            mediaType={block.mediaType}
                            alt="Screenshot of the sandbox desktop"
                          />
                        )
                    }
                  })}
                </MessageContent>
              </Message>
            ))
          )}
          {error && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>Something went wrong</AlertTitle>
              <AlertDescription>{error.message}</AlertDescription>
              <AlertAction>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => regenerate()}
                >
                  Retry
                </Button>
              </AlertAction>
            </Alert>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="mx-auto w-full max-w-3xl p-4 pt-0">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputBody>
            <PromptInputTextarea placeholder="Send a message..." />
          </PromptInputBody>
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} onStop={stop} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  )
}

type Block = { index: number } & (
  | { kind: "text"; text: string }
  | { kind: "tools"; parts: ToolPart[] }
  | { kind: "screen"; base64: string; mediaType: string }
)

// One Trace per run of tool calls. Text and shown screenshots end a run.
function groupParts(parts: Part[]) {
  const blocks: Block[] = []

  parts.forEach((part, index) => {
    if (part.type === "text") {
      blocks.push({ kind: "text", text: part.text, index })
    } else if (
      part.type === "tool-showScreen" &&
      part.state === "output-available"
    ) {
      blocks.push({ kind: "screen", ...part.output, index })
    } else if (part.type.startsWith("tool-")) {
      const last = blocks.at(-1)
      if (last?.kind === "tools") last.parts.push(part as ToolPart)
      else blocks.push({ kind: "tools", parts: [part as ToolPart], index })
    }
  })

  return blocks
}

type Status = "running" | "error" | undefined

function toolStatus(part: ToolPart): Status {
  if (part.state === "output-error") return "error"
  if (part.state === "input-streaming" || part.state === "input-available") {
    return "running"
  }
}

type ToolSummary = {
  icon: LucideIcon
  // What the line says while running, once done, and on failure
  verbs: [running: string, done: string, failed: string]
  subject: string
  description?: string
  output?: string
  outputFailed?: boolean
}

const at = (input?: { x?: number; y?: number }) =>
  input?.x === undefined ? "" : `at (${input.x}, ${input.y})`

function summarize(part: ToolPart): ToolSummary {
  switch (part.type) {
    case "tool-bash": {
      const result = part.state === "output-available" ? part.output : null
      return {
        icon: SquareTerminalIcon,
        verbs: ["Running", "Ran", "Failed to run"],
        subject: part.input?.command ?? "a command",
        description:
          result && result.exitCode !== 0
            ? `exit ${result.exitCode}`
            : undefined,
        output: result ? result.output || "(no output)" : undefined,
        outputFailed: !!result && result.exitCode !== 0,
      }
    }
    case "tool-readFile":
      return {
        icon: FileTextIcon,
        verbs: ["Reading", "Read", "Failed to read"],
        subject: part.input?.path ?? "a file",
        output:
          part.state === "output-available" ? part.output.content : undefined,
      }
    case "tool-writeFile":
      return {
        icon: FilePenIcon,
        verbs: ["Writing", "Wrote", "Failed to write"],
        subject: part.input?.path ?? "a file",
        description:
          part.state === "output-available"
            ? `${part.output.bytes} bytes`
            : undefined,
        output:
          part.state === "output-available" ? part.input.content : undefined,
      }
    case "tool-listFiles": {
      const entries =
        part.state === "output-available" ? part.output.entries : null
      return {
        icon: FolderOpenIcon,
        verbs: ["Listing", "Listed", "Failed to list"],
        subject: part.input?.path ?? "a directory",
        description: entries ? `${entries.length} items` : undefined,
        output: entries
          ? entries
              .map((entry) => (entry.isDir ? `${entry.name}/` : entry.name))
              .join("\n") || "(empty)"
          : undefined,
      }
    }
    case "tool-viewScreen":
      return {
        icon: EyeIcon,
        verbs: ["Looking at", "Looked at", "Failed to look at"],
        subject: "the screen",
      }
    case "tool-showScreen":
      return {
        icon: MonitorIcon,
        verbs: ["Taking", "Took", "Failed to take"],
        subject: "a screenshot",
      }
    case "tool-click":
      return {
        icon: MousePointerClickIcon,
        verbs: part.input?.double
          ? ["Double-clicking", "Double-clicked", "Failed to double-click"]
          : ["Clicking", "Clicked", "Failed to click"],
        subject: at(part.input),
        description:
          part.input?.button && part.input.button !== "left"
            ? `${part.input.button} button`
            : undefined,
      }
    case "tool-moveMouse":
      return {
        icon: MousePointer2Icon,
        verbs: ["Moving the pointer", "Moved the pointer", "Failed to move the pointer"],
        subject: part.input?.x === undefined ? "" : `to (${part.input.x}, ${part.input.y})`,
      }
    case "tool-scroll":
      return {
        icon: MouseIcon,
        verbs: ["Scrolling", "Scrolled", "Failed to scroll"],
        subject: `${part.input?.direction ?? ""} ${at(part.input)}`,
      }
    case "tool-pressKey":
      return {
        icon: KeyboardIcon,
        verbs: ["Pressing", "Pressed", "Failed to press"],
        subject: [...(part.input?.modifiers ?? []), part.input?.key ?? "a key"]
          .filter(Boolean)
          .join("+"),
      }
    case "tool-typeText":
      return {
        icon: TypeIcon,
        verbs: ["Typing", "Typed", "Failed to type"],
        subject: part.input?.text ? `“${part.input.text}”` : "text",
      }
  }
}

// A line until there is output to open, then a collapsible with the output
function ToolRow({ part }: { part: ToolPart }) {
  const summary = summarize(part)
  const status = toolStatus(part)
  const verb =
    summary.verbs[status === "running" ? 0 : status === "error" ? 2 : 1]
  const output = status === "error" ? part.errorText : summary.output
  const Icon = summary.icon

  const line = (
    <TraceLine status={status}>
      <TraceIcon>
        <Icon />
      </TraceIcon>
      <TraceTitle>
        {verb} {summary.subject}
      </TraceTitle>
      {summary.description && (
        <TraceDescription>{summary.description}</TraceDescription>
      )}
    </TraceLine>
  )

  if (output === undefined) return line

  return (
    <TraceCollapsible>
      <TraceCollapsibleTrigger>{line}</TraceCollapsibleTrigger>
      <TraceCollapsibleContent>
        <CodeBlock
          size="sm"
          variant={
            status === "error" || summary.outputFailed
              ? "destructive"
              : "default"
          }
        >
          <CodeBlockContent wrap className="max-h-64">
            {output}
          </CodeBlockContent>
        </CodeBlock>
      </TraceCollapsibleContent>
    </TraceCollapsible>
  )
}
