"use client"

import * as React from "react"
import type { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { zodResolver } from "@hookform/resolvers/zod"
import { ShuffleIcon } from "lucide-react"
import { nanoid } from "nanoid"
import { Controller, useForm, useWatch } from "react-hook-form"
import type { z } from "zod"

import { createBot } from "@/action/bot"
import { ChatAvatar } from "@/components/chat-avatar"
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
import { insertBotSchema } from "@/db/schema"

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

function BotDialog({
  children,
  handle,
}: {
  children?: React.ReactElement
  handle?: DialogPrimitive.Handle<unknown>
}) {
  const [open, setOpen] = React.useState(false)
  const [isPending, startTransition] = React.useTransition()

  const form = useForm<BotFormInput, unknown, BotFormOutput>({
    resolver: zodResolver(insertBotSchema),
    defaultValues: { name: "", avatar: "", job: "", instructions: "" },
  })
  const avatar = useWatch({ control: form.control, name: "avatar" })

  function handleOpenChange(next: boolean) {
    // Start every new bot with a blank form and a fresh face
    if (next) form.reset(emptyValues())
    setOpen(next)
  }

  function onSubmit(values: BotFormOutput) {
    startTransition(async () => {
      try {
        const result = await createBot(values)
        if (!result.ok) {
          for (const [key, messages] of Object.entries(result.errors)) {
            form.setError(key as keyof BotFormInput, {
              message: messages?.[0],
            })
          }
          return
        }
        toast.add({ title: `${result.bot.name} is ready` })
        setOpen(false)
      } catch {
        toast.add({
          title: "Couldn't create the bot",
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
          <DialogTitle>New bot</DialogTitle>
          <DialogDescription>
            Give it a face, a name, and a job to do.
          </DialogDescription>
        </DialogHeader>
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
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button type="submit" form="bot-form" disabled={isPending}>
            {isPending && <Spinner data-icon="inline-start" />}
            Create bot
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { BotDialog }
