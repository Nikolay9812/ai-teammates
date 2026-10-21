"use client"

import * as React from "react"
import type { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { zodResolver } from "@hookform/resolvers/zod"
import { TrashIcon } from "lucide-react"
import { unstable_rethrow, useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import type { z } from "zod"

import {
  createGroupChat,
  deleteGroupChat,
  updateGroupChat,
} from "@/action/group-chat"
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
import { Checkbox } from "@/components/ui/checkbox"
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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { type Bot, insertGroupChatSchema } from "@/db/schema"

type GroupChatFormInput = z.input<typeof insertGroupChatSchema>
type GroupChatFormOutput = z.output<typeof insertGroupChatSchema>

// Edits the given group, or creates a new one when there is none
function GroupChatDialog({
  children,
  handle,
  bots,
  chat,
}: {
  children?: React.ReactElement
  handle?: DialogPrimitive.Handle<unknown>
  bots: Pick<Bot, "id" | "name" | "avatar">[]
  chat?: { id: string; name: string; botIds: string[] }
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [isPending, startTransition] = React.useTransition()
  const [isDeleting, startDeleteTransition] = React.useTransition()

  const form = useForm<GroupChatFormInput, unknown, GroupChatFormOutput>({
    resolver: zodResolver(insertGroupChatSchema),
    defaultValues: { name: "", botIds: [] },
  })

  function handleOpenChange(next: boolean) {
    // Start edits from the saved group, and new groups blank
    if (next) {
      form.reset(
        chat
          ? { name: chat.name, botIds: chat.botIds }
          : { name: "", botIds: [] }
      )
    }
    setOpen(next)
  }

  function onSubmit(values: GroupChatFormOutput) {
    startTransition(async () => {
      try {
        const result = chat
          ? await updateGroupChat(chat.id, values)
          : await createGroupChat(values)
        if (!result.ok) {
          for (const [key, messages] of Object.entries(result.errors)) {
            form.setError(key as keyof GroupChatFormInput, {
              message: messages?.[0],
            })
          }
          return
        }
        toast.add({
          title: chat
            ? `${result.chat.name} is updated`
            : `${result.chat.name} is ready`,
        })
        setOpen(false)
        if (!chat) router.push(`/chats/${result.chat.id}`)
      } catch {
        toast.add({
          title: chat ? "Couldn't save the group" : "Couldn't create the group",
          description: "Something went wrong. Try again.",
        })
      }
    })
  }

  function onDelete(chatId: string) {
    startDeleteTransition(async () => {
      try {
        // Redirects home on success, so nothing runs after it
        await deleteGroupChat(chatId)
      } catch (error) {
        // Let the redirect through; only real failures get a toast
        unstable_rethrow(error)
        toast.add({
          title: "Couldn't delete the group",
          description: "Something went wrong. Try again.",
        })
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} handle={handle}>
      {children && <DialogTrigger render={children} />}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {chat ? "Edit group chat" : "New group chat"}
          </DialogTitle>
          <DialogDescription>
            {chat
              ? "Rename the group or change which bots are in it."
              : "Name the group and pick which bots are in it."}
          </DialogDescription>
        </DialogHeader>
        <form id="group-chat-form" onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="group-chat-name">Name</FieldLabel>
                  <Input
                    {...field}
                    id="group-chat-name"
                    placeholder="Weekend plans"
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
              name="botIds"
              control={form.control}
              render={({ field, fieldState }) => (
                <FieldSet data-invalid={fieldState.invalid}>
                  <FieldLegend variant="label">Bots</FieldLegend>
                  {bots.length === 0 && (
                    <FieldDescription>Create a bot first.</FieldDescription>
                  )}
                  <FieldGroup data-slot="checkbox-group" className="gap-3">
                    {bots.map((bot) => (
                      <Field
                        key={bot.id}
                        orientation="horizontal"
                        data-invalid={fieldState.invalid}
                      >
                        <Checkbox
                          id={`group-chat-bot-${bot.id}`}
                          checked={field.value.includes(bot.id)}
                          onCheckedChange={(checked) =>
                            field.onChange(
                              checked
                                ? [...field.value, bot.id]
                                : field.value.filter((id) => id !== bot.id)
                            )
                          }
                          aria-invalid={fieldState.invalid}
                        />
                        <FieldLabel
                          htmlFor={`group-chat-bot-${bot.id}`}
                          className="font-normal"
                        >
                          <ChatAvatar seed={bot.avatar} className="size-6" />
                          {bot.name}
                        </FieldLabel>
                      </Field>
                    ))}
                  </FieldGroup>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </FieldSet>
              )}
            />
          </FieldGroup>
        </form>
        <DialogFooter>
          {chat && (
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
                  <AlertDialogTitle>Delete {chat.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This deletes the group chat, but its bots stay. You
                    can&apos;t undo this.
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
                    onClick={() => onDelete(chat.id)}
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
            form="group-chat-form"
            disabled={isPending || isDeleting}
          >
            {isPending && <Spinner data-icon="inline-start" />}
            {chat ? "Save changes" : "Create group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { GroupChatDialog }
