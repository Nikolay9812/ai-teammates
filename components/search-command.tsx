"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { SearchIcon } from "lucide-react"

import { ChatAvatar } from "@/components/chat-avatar"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Kbd } from "@/components/ui/kbd"

type SearchChat = {
  id: string
  name: string
  avatar: string
}

function SearchCommand({ chats }: { chats: SearchChat[] }) {
  const [open, setOpen] = React.useState(false)
  const router = useRouter()

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <>
      <Button
        variant="outline"
        className="h-8 w-full min-w-0 justify-start rounded-lg border border-input bg-transparent px-2.5 py-1 text-base font-normal text-muted-foreground md:text-sm dark:bg-input/30"
        onClick={() => setOpen(true)}
      >
        <SearchIcon data-icon="inline-start" />
        Search
        <Kbd className="ml-auto gap-0 text-sm">
          ⌘<span className="text-base">K</span>
        </Kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search chats"
        description="Search for a chat to open"
      >
        <Command>
          <CommandInput placeholder="Search chats..." />
          <CommandList>
            <CommandEmpty>No chats found.</CommandEmpty>
            <CommandGroup heading="Chats">
              {chats.map((chat) => (
                <CommandItem
                  key={chat.id}
                  value={chat.id}
                  keywords={[chat.name]}
                  onSelect={() => {
                    setOpen(false)
                    router.push(`/chats/${chat.id}`)
                  }}
                >
                  <ChatAvatar seed={chat.avatar} className="size-6" />
                  <span className="truncate">{chat.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}

export { SearchCommand }
