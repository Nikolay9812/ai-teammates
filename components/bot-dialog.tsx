"use client"

import * as React from "react"
import type { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { zodResolver } from "@hookform/resolvers/zod"
import { ShuffleIcon, TrashIcon } from "lucide-react"
import { nanoid } from "nanoid"
import { unstable_rethrow } from "next/navigation"
import { Controller, useForm, useWatch } from "react-hook-form"
import type { z } from "zod"

import { createBot, deleteBot, updateBot } from "@/action/bot"
import { ChatAvatar } from "@/components/chat-avatar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { insertBotSchema, type Bot } from "@/db/schema"
import { useLimitToast, usePlanGate } from "@/hooks/use-plan-gate"
import { BOTS, SANDBOXES } from "@/lib/plan"

type BotFormInput = z.input<typeof insertBotSchema>
type BotFormOutput = z.output<typeof insertBotSchema>

const templates = [
  {
    name: "Ada",
    job: "Research assistant",
    instructions:
      "Answer briefly, cite sources, and ask before running anything destructive.",
  },
  {
    name: "Linus",
    job: "Code reviewer",
    instructions:
      "Look for bugs before style. Suggest concrete fixes and explain why they matter.",
  },
  {
    name: "Maxwell",
    job: "Writing editor",
    instructions:
      "Tighten the prose without changing the voice. Flag unclear sentences and offer shorter ones.",
  },
  {
    name: "Sage",
    job: "Tutor",
    instructions:
      "Teach step by step. Ask a question before giving the answer, and check understanding as you go.",
  },
]

function emptyValues(): BotFormInput {
  return { name: "", avatar: nanoid(), job: "", instructions: "" }
}

function botValues(
  bot: Pick<Bot, "name" | "avatar" | "job" | "instructions">
): BotFormInput {
  return {
    name: bot.name,
    avatar: bot.avatar,
    job: bot.job,
    instructions: bot.instructions ?? "",
  }
}

// Edits the given bot, or creates a new one when there is none
function BotDialog({
  children,
  handle,
  bot,
}: {
  children?: React.ReactElement
  handle?: DialogPrimitive.Handle<unknown>
  bot?: Pick<Bot, "id" | "name" | "avatar" | "job" | "instructions">
}) {
  const [open, setOpen] = React.useState(false)
  const [isPending, startTransition] = React.useTransition()
  const [isDeleting, startDeleteTransition] = React.useTransition()
  const planAllows = usePlanGate()
  const showLimit = useLimitToast()

  const form = useForm<BotFormInput, unknown, BotFormOutput>({
    resolver: zodResolver(insertBotSchema),
    defaultValues: { name: "", avatar: "", job: "", instructions: "" },
  })
  const avatar = useWatch({ control: form.control, name: "avatar" })

  function handleOpenChange(next: boolean) {
    // Editing stays free, but a new bot and its sandbox need the plan
    if (next && !bot && !planAllows(BOTS, SANDBOXES)) return
    // Start edits from the saved bot, and new bots blank with a fresh face
    if (next) form.reset(bot ? botValues(bot) : emptyValues())
    setOpen(next)
  }

  function onSubmit(values: BotFormOutput) {
    startTransition(async () => {
      try {
        const result = bot
          ? await updateBot(bot.id, values)
          : await createBot(values)
        if (!result.ok && "limit" in result) {
          showLimit(result.limit)
          return
        }
        if (!result.ok) {
          for (const [key, messages] of Object.entries(result.errors)) {
            form.setError(key as keyof BotFormInput, {
              message: messages?.[0],
            })
          }
          return
        }
        toast.add({
          title: bot
            ? `${result.bot.name} is updated`
            : `${result.bot.name} is ready`,
        })
        setOpen(false)
      } catch {
        toast.add({
          title: bot ? "Couldn't save the bot" : "Couldn't create the bot",
          description: "Something went wrong. Try again.",
        })
      }
    })
  }

  function onDelete(botId: string) {
    startDeleteTransition(async () => {
      try {
        // Redirects home on success, so nothing runs after it
        await deleteBot(botId)
      } catch (error) {
        // Let the redirect through; only real failures get a toast
        unstable_rethrow(error)
        toast.add({
          title: "Couldn't delete the bot",
          description: "Something went wrong. Try again.",
        })
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} handle={handle}>
      {children && <DialogTrigger render={children} />}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{bot ? "Edit bot" : "New bot"}</DialogTitle>
          <DialogDescription>
            {bot
              ? "Change its face, name, or how it does its job."
              : "Give it a face, a name, and a job to do."}
          </DialogDescription>
        </DialogHeader>
        {!bot && (
          <div className="flex flex-wrap gap-2">
            {templates.map((template) => (
              <Button
                key={template.job}
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() =>
                  form.reset({ ...template, avatar: form.getValues("avatar") })
                }
              >
                {template.job}
              </Button>
            ))}
          </div>
        )}
        <form id="bot-form" onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Item className="px-0">
              <ItemMedia>
                {avatar && <ChatAvatar seed={avatar} className="size-10" />}
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Face</ItemTitle>
                <ItemDescription>
                  Shuffle until you find one you like.
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => form.setValue("avatar", nanoid())}
                >
                  <ShuffleIcon data-icon="inline-start" />
                  Shuffle
                </Button>
              </ItemActions>
            </Item>
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="bot-name">Name</FieldLabel>
                  <Input
                    {...field}
                    id="bot-name"
                    placeholder="Ada"
                    autoComplete="off"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="job"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="bot-job">Job</FieldLabel>
                  <Input
                    {...field}
                    id="bot-job"
                    placeholder="Research assistant"
                    autoComplete="off"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="instructions"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="bot-instructions">
                    How it should work
                  </FieldLabel>
                  <Textarea
                    {...field}
                    value={field.value ?? ""}
                    id="bot-instructions"
                    placeholder="Answer briefly, cite sources, and ask before running anything destructive."
                    className="min-h-24"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </FieldGroup>
        </form>
        <DialogFooter>
          {bot && (
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button
                    type="button"
                    variant="destructive"
                    className="sm:mr-auto"
                    disabled={isPending}
                  />
                }
              >
                <TrashIcon data-icon="inline-start" />
                Delete
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {bot.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This deletes the bot and its chat. You can&apos;t undo this.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    type="button"
                    variant="destructive"
                    disabled={isDeleting}
                    onClick={() => onDelete(bot.id)}
                  >
                    {isDeleting && <Spinner data-icon="inline-start" />}
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            type="submit"
            form="bot-form"
            disabled={isPending || isDeleting}
          >
            {isPending && <Spinner data-icon="inline-start" />}
            {bot ? "Save changes" : "Create bot"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { BotDialog }
