import Image from "next/image"
import { Avatar, Style } from "@dicebear/core"
import definition from "@dicebear/styles/gaze.json" with { type: "json" }
import { cn } from "cn"

const style = new Style(definition)

function ChatAvatar({
  seed,
  animated = false,
  alt = "",
  className,
}: {
  seed: string
  animated?: boolean
  // Decorative by default, since a name usually sits beside it
  alt?: string
  className?: string
}) {
  const src = new Avatar(style, {
    seed,
    animationVariant: [animated ? "medium" : "none"],
  }).toDataUri()

  return (
    <Image
      src={src}
      alt={alt}
      width={32}
      height={32}
      unoptimized
      className={cn("size-8 shrink-0 rounded-full", className)}
    />
  )
}

export { ChatAvatar }
