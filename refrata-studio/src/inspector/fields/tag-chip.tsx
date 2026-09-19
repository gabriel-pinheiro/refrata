import { Lock, X } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * One Tag as a chip. A declared Tag is locked and says so; a person's has a
 * cross to remove it. `note` marks a chip that needs a word, such as a Tag
 * in a Rule that no Element carries.
 */
export function TagChip({
  tag,
  locked = false,
  note,
  onRemove,
}: {
  readonly tag: string;
  readonly locked?: boolean;
  readonly note?: string | undefined;
  readonly onRemove?: () => void;
}): ReactNode {
  return (
    <Badge
      variant={locked ? "outline" : "secondary"}
      className={cn(
        "max-w-full gap-0.5",
        onRemove !== undefined && "pr-0.5",
        note !== undefined && "border-amber-500/60 text-amber-300",
      )}
      title={
        note ?? (locked ? `${tag} is declared by the Fixture Type` : undefined)
      }
    >
      {locked && <Lock className="opacity-60" />}
      <span className="truncate">{tag}</span>
      {note !== undefined && (
        <span className="font-normal italic opacity-80">{note}</span>
      )}
      {onRemove !== undefined && (
        <button
          type="button"
          aria-label={`Remove ${tag}`}
          className="grid size-4 shrink-0 place-items-center rounded-full hover:bg-foreground/15"
          onClick={onRemove}
        >
          <X className="size-2.5" />
        </button>
      )}
    </Badge>
  );
}
