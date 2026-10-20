import { cn } from "@/lib/utils";
import type { Experimental_GeneratedImage } from "ai";

// Only base64 is rendered, so images that never had bytes decoded can skip uint8Array
export type ImageProps = Omit<Experimental_GeneratedImage, "uint8Array"> & {
  uint8Array?: Uint8Array;
  className?: string;
  alt?: string;
};

export const Image = ({
  base64,
  uint8Array: _uint8Array,
  mediaType,
  ...props
}: ImageProps) => (
  <img
    {...props}
    alt={props.alt}
    className={cn(
      "h-auto max-w-full overflow-hidden rounded-md",
      props.className
    )}
    src={`data:${mediaType};base64,${base64}`}
  />
);
