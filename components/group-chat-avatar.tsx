import { cn } from "cn"

import { ChatAvatar } from "@/components/chat-avatar"

// Faces shown before the rest collapse into a count
const MAX_FACES = 3

// Where each item sits inside the avatar's square, by how many items there are
const layouts = [
  [],
  ["inset-0 size-full"],
  // Side by side, overlapping
  ["top-[18.75%] left-0 size-[62.5%]", "top-[18.75%] right-0 size-[62.5%]"],
  // A triangle, point up
  [
    "top-0 left-[22.5%] size-[55%]",
    "bottom-0 left-0 size-[55%]",
    "right-0 bottom-0 size-[55%]",
  ],
  // A 2x2 grid
  [
    "top-0 left-0 size-1/2",
    "top-0 right-0 size-1/2",
    "bottom-0 left-0 size-1/2",
    "right-0 bottom-0 size-1/2",
  ],
]

// The faces of a group's bots, in the same footprint as a single ChatAvatar
function GroupChatAvatar({
  seeds,
  className,
}: {
  seeds: string[]
  className?: string
}) {
  const overflow = seeds.length > MAX_FACES ? seeds.length - MAX_FACES : 0
  const faces = seeds.slice(0, MAX_FACES)
  const layout = layouts[faces.length + (overflow ? 1 : 0)]

  return (
    <div
      className={cn(
        "relative size-8 shrink-0",
        seeds.length === 0 && "rounded-full bg-muted",
        className
      )}
    >
      {faces.map((seed, index) => (
        <ChatAvatar
          key={index}
          seed={seed}
          className={cn("absolute", layout[index])}
        />
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            "@container absolute flex items-center justify-center rounded-full bg-muted font-medium text-muted-foreground",
            layout[faces.length]
          )}
        >
          <span className="text-[45cqw] leading-none">+{overflow}</span>
        </span>
      )}
    </div>
  )
}

export { GroupChatAvatar }
