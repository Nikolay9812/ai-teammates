import { chat, type InferChatUIMessageFromTools } from "@trigger.dev/sdk/ai"
import { tool } from "ai"
import { z } from "zod"

import { getDesktopSandbox, getStartedSandbox } from "@/lib/daytona"

// The sandbox of the bot answering this turn, set in the agent's onTurnStart
export const botSandbox = chat.local<{ sandboxId: string }>({
  id: "botSandbox",
})

// Keeps long command output and files from flooding the context
const MAX_OUTPUT = 20_000

function truncate(text: string) {
  return text.length > MAX_OUTPUT
    ? `${text.slice(0, MAX_OUTPUT)}\n… (${text.length - MAX_OUTPUT} more characters cut)`
    : text
}

const sandbox = () => getStartedSandbox(botSandbox.sandboxId)
const desktop = () => getDesktopSandbox(botSandbox.sandboxId)

// JPEG keeps a full-resolution screenshot well under the ~1 MiB stream record cap
async function takeScreenshot() {
  const { screenshot } = await (
    await desktop()
  ).computerUse.screenshot.takeCompressed({
    format: "jpeg",
    quality: 70,
    showCursor: true,
  })
  if (!screenshot) throw new Error("The screenshot came back empty")
  return { mediaType: "image/jpeg" as const, base64: screenshot }
}

// The model sees the screenshot as an image, not as base64 text
function screenshotToModel({
  output,
}: {
  output: Awaited<ReturnType<typeof takeScreenshot>>
}) {
  return {
    type: "content" as const,
    value: [
      {
        type: "file" as const,
        mediaType: output.mediaType,
        data: { type: "data" as const, data: output.base64 },
      },
    ],
  }
}

const point = {
  x: z.number().int().min(0).describe("Pixels from the left edge"),
  y: z.number().int().min(0).describe("Pixels from the top edge"),
}

export const tools = {
  bash: tool({
    description:
      "Run a shell command in your sandbox and get its exit code and output. " +
      "Commands time out after 2 minutes; start long-running processes in the background.",
    inputSchema: z.object({
      command: z.string().describe("The command, run with sh"),
      cwd: z
        .string()
        .optional()
        .describe("Working directory. Defaults to your home directory."),
    }),
    execute: async ({ command, cwd }) => {
      const { exitCode, result } = await (
        await sandbox()
      ).process.executeCommand(command, cwd, undefined, 120)
      return { exitCode, output: truncate(result) }
    },
  }),

  readFile: tool({
    description: "Read a text file from your sandbox.",
    inputSchema: z.object({
      path: z.string().describe("Absolute, or relative to your home directory"),
    }),
    execute: async ({ path }) => {
      const file = await (await sandbox()).fs.downloadFile(path)
      return { content: truncate(file.toString("utf8")) }
    },
  }),

  writeFile: tool({
    description:
      "Write a text file in your sandbox, replacing it if it exists. Parent directories must exist.",
    inputSchema: z.object({
      path: z.string().describe("Absolute, or relative to your home directory"),
      content: z.string(),
    }),
    execute: async ({ path, content }) => {
      const file = Buffer.from(content, "utf8")
      await (await sandbox()).fs.uploadFile(file, path)
      return { bytes: file.length }
    },
  }),

  listFiles: tool({
    description: "List the files and directories in a directory of your sandbox.",
    inputSchema: z.object({
      path: z
        .string()
        .describe("Absolute, or relative to your home directory. Use . for home."),
    }),
    execute: async ({ path }) => {
      const files = await (await sandbox()).fs.listFiles(path)
      return {
        entries: files.map((file) => ({
          name: file.name,
          isDir: file.isDir,
          size: file.size,
        })),
      }
    },
  }),

  viewScreen: tool({
    description:
      "Take a screenshot of your desktop so you can see it. Use it before acting on the screen " +
      "and after to check the result. The person you're chatting with doesn't see it; " +
      "use showScreen when they ask to see your screen.",
    inputSchema: z.object({}),
    execute: takeScreenshot,
    toModelOutput: screenshotToModel,
  }),

  showScreen: tool({
    description:
      "Take a screenshot of your desktop and show it in the chat. Use it when the person " +
      "you're chatting with asks to see your screen or what's on it. You see it too.",
    inputSchema: z.object({}),
    execute: takeScreenshot,
    toModelOutput: screenshotToModel,
  }),

  click: tool({
    description: "Click the mouse at a point on your desktop.",
    inputSchema: z.object({
      ...point,
      button: z.enum(["left", "right", "middle"]).default("left"),
      double: z.boolean().default(false).describe("Double-click"),
    }),
    execute: async ({ x, y, button, double }) => {
      await (await desktop()).computerUse.mouse.click(x, y, button, double)
      return { ok: true }
    },
  }),

  moveMouse: tool({
    description: "Move the mouse pointer to a point on your desktop, e.g. to hover.",
    inputSchema: z.object(point),
    execute: async ({ x, y }) => {
      await (await desktop()).computerUse.mouse.move(x, y)
      return { ok: true }
    },
  }),

  scroll: tool({
    description: "Scroll the mouse wheel with the pointer at a point on your desktop.",
    inputSchema: z.object({
      ...point,
      direction: z.enum(["up", "down"]),
      amount: z
        .number()
        .int()
        .min(1)
        .max(20)
        .default(3)
        .describe("Wheel ticks, a few lines each"),
    }),
    execute: async ({ x, y, direction, amount }) => {
      await (await desktop()).computerUse.mouse.scroll(x, y, direction, amount)
      return { ok: true }
    },
  }),

  pressKey: tool({
    description:
      "Press a key on your desktop's keyboard, optionally with modifiers held. " +
      "Keys: letters, digits, punctuation, enter, escape, tab, backspace, delete, space, " +
      "home, end, pageup, pagedown, up, down, left, right, f1-f24.",
    inputSchema: z.object({
      key: z.string().describe("e.g. enter, a, f5"),
      modifiers: z
        .array(z.enum(["ctrl", "alt", "shift", "cmd"]))
        .default([])
        .describe("Held while the key is pressed"),
    }),
    execute: async ({ key, modifiers }) => {
      await (await desktop()).computerUse.keyboard.press(key, modifiers)
      return { ok: true }
    },
  }),

  typeText: tool({
    description:
      "Type text on your desktop's keyboard into whatever has focus. Newlines press enter.",
    inputSchema: z.object({ text: z.string() }),
    execute: async ({ text }) => {
      await (await desktop()).computerUse.keyboard.type(text)
      return { ok: true }
    },
  }),
}

export type ChatUIMessage = InferChatUIMessageFromTools<typeof tools>
