"use client"

import { cn } from "cn"
import { MonitorIcon, RefreshCwIcon } from "lucide-react"
import { createContext, useContext, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { getChatDesktopUrl } from "@/action/chat"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ResizableHandle, ResizablePanel } from "@/components/ui/resizable"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { Toggle } from "@/components/ui/toggle"
import { usePlanGate } from "@/hooks/use-plan-gate"
import { SANDBOXES } from "@/lib/plan"

type DesktopStatus = "idle" | "loading" | "ready" | "error"

type DesktopPanelContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
  expanded: boolean
  setExpanded: (expanded: boolean) => void
  status: DesktopStatus
  url: string | null
  reload: () => void
  panelSlot: HTMLElement | null
  setPanelSlot: (slot: HTMLElement | null) => void
  dialogSlot: HTMLElement | null
  setDialogSlot: (slot: HTMLElement | null) => void
}

const DesktopPanelContext = createContext<DesktopPanelContextValue | null>(null)

function useDesktopPanel() {
  const context = useContext(DesktopPanelContext)
  if (!context) {
    throw new Error("useDesktopPanel must be used within DesktopPanelProvider")
  }
  return context
}

export function DesktopPanelProvider({
  chatId,
  children,
}: {
  chatId: string
  children: React.ReactNode
}) {
  const [open, setOpenState] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [status, setStatus] = useState<DesktopStatus>("idle")
  const [url, setUrl] = useState<string | null>(null)
  const [panelSlot, setPanelSlot] = useState<HTMLElement | null>(null)
  const [dialogSlot, setDialogSlot] = useState<HTMLElement | null>(null)
  const planAllows = usePlanGate()

  async function reload() {
    // Connecting to a sandbox's desktop needs the plan
    if (!planAllows(SANDBOXES)) return
    setStatus("loading")
    try {
      setUrl(await getChatDesktopUrl(chatId))
      setStatus("ready")
    } catch {
      setStatus("error")
      toast.add({
        title: "Couldn't load the desktop",
        description: "Something went wrong. Try again.",
      })
    }
  }

  function setOpen(next: boolean) {
    // Without the plan the panel would only ever show an error
    if (next && !planAllows(SANDBOXES)) return
    setOpenState(next)
    // Load the desktop the first time it's shown, then keep it for the page's lifetime
    if (next && status === "idle") reload()
  }

  return (
    <DesktopPanelContext.Provider
      value={{
        open,
        setOpen,
        expanded,
        setExpanded,
        status,
        url,
        reload,
        panelSlot,
        setPanelSlot,
        dialogSlot,
        setDialogSlot,
      }}
    >
      {children}
      <DesktopFrame />
    </DesktopPanelContext.Provider>
  )
}

// One iframe for the page, laid over the panel preview or the dialog. Moving an
// iframe in the DOM reloads it, so it stays put and follows the visible slot.
function DesktopFrame() {
  const { open, expanded, url, panelSlot, dialogSlot } = useDesktopPanel()
  const frameRef = useRef<HTMLIFrameElement>(null)
  const slot = expanded ? dialogSlot : open ? panelSlot : null

  useEffect(() => {
    const frame = frameRef.current
    if (!frame || !slot) return

    // Follow the slot every frame, so panel resizes and dialog animations stay in sync
    let request = 0
    const follow = () => {
      const { top, left, width, height } = slot.getBoundingClientRect()
      frame.style.top = `${top}px`
      frame.style.left = `${left}px`
      frame.style.width = `${width}px`
      frame.style.height = `${height}px`
      request = requestAnimationFrame(follow)
    }
    follow()
    return () => cancelAnimationFrame(request)
  }, [slot, url])

  if (!url) return null

  return createPortal(
    <iframe
      key={url}
      ref={frameRef}
      src={url}
      title="Desktop"
      allow="clipboard-read; clipboard-write"
      tabIndex={expanded ? 0 : -1}
      className={cn(
        "fixed rounded-lg",
        !slot && "hidden",
        // Above the dialog while expanded; the panel preview only opens the dialog
        expanded ? "z-[51]" : "pointer-events-none"
      )}
    />,
    document.body
  )
}

export function DesktopPanelToggle() {
  const { open, setOpen } = useDesktopPanel()

  return (
    <Toggle
      size="sm"
      pressed={open}
      onPressedChange={setOpen}
      aria-label="Desktop"
    >
      <MonitorIcon />
    </Toggle>
  )
}

export function DesktopPanel({ name }: { name: string }) {
  const {
    open,
    expanded,
    setExpanded,
    status,
    reload,
    setPanelSlot,
    setDialogSlot,
  } = useDesktopPanel()

  if (!open) return null

  const title = `${name}'s screen`

  return (
    <>
      <ResizableHandle />
      <ResizablePanel
        id="desktop"
        defaultSize="50"
        minSize="25"
        className="flex flex-col"
      >
        <div className="flex h-10 shrink-0 items-center justify-end px-4">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Reload desktop"
            disabled={status === "loading"}
            onClick={reload}
          >
            <RefreshCwIcon />
          </Button>
        </div>
        <div className="flex flex-col gap-3 p-4">
          <Dialog
            open={expanded}
            onOpenChange={(next, { reason }) => {
              // The desktop takes keys and clicks, so only the close button closes it
              if (!next && reason !== "close-press") return
              setExpanded(next)
            }}
            // Modal dialogs make everything outside the popup inert, including the iframe
            modal={false}
            disablePointerDismissal
          >
            <DialogTrigger
              ref={setPanelSlot}
              render={
                <button
                  type="button"
                  className="flex aspect-4/3 w-full items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground ring-1 ring-foreground/10 outline-none hover:ring-foreground/20 focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              }
              aria-label={`Open ${title}`}
            >
              {status === "loading" && <Spinner />}
              {status === "error" && "Couldn't load the desktop"}
            </DialogTrigger>
            <DialogContent className="flex h-[calc(100svh-2rem)] flex-col sm:max-w-[calc(100%-2rem)]">
              <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>
                  Click and type to control the desktop.
                </DialogDescription>
              </DialogHeader>
              <div
                ref={setDialogSlot}
                className="min-h-0 flex-1 rounded-lg bg-muted"
              />
            </DialogContent>
          </Dialog>
          <p className="text-center text-sm text-muted-foreground">{title}</p>
        </div>
      </ResizablePanel>
    </>
  )
}
