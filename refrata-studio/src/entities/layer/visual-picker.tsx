import { ATTRIBUTES, CATALOG, type SlotDefinition } from "@refrata/core";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Picks one Visual of the Catalog: the names at the left; at the right the
 * selected one's description, its Slots with what each binds to by default,
 * and its Cues. A click or the arrow keys select, Enter or a double click
 * picks.
 */
export function VisualPicker({
  title,
  description,
  current,
  submitLabel,
  onSubmit,
  onClose,
}: {
  readonly title: string;
  /** Said under the title, such as what changing the Visual resets. */
  readonly description?: string | undefined;
  /** The Visual the Layer runs now: highlighted first and not pickable again. */
  readonly current?: string | undefined;
  readonly submitLabel: string;
  readonly onSubmit: (visual: string) => void;
  readonly onClose: () => void;
}) {
  const [highlighted, setHighlighted] = useState(() =>
    Math.max(
      0,
      CATALOG.findIndex((definition) => definition.id === current),
    ),
  );
  const definition = CATALOG[highlighted];
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  // Focus follows the highlight, so the ring and the notes name one Visual.
  useEffect(() => options.current[highlighted]?.focus(), [highlighted]);

  function submit(): void {
    if (definition === undefined || definition.id === current) return;
    onClose();
    onSubmit(definition.id);
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>): void {
    if (event.key === "ArrowDown")
      setHighlighted(Math.min(highlighted + 1, CATALOG.length - 1));
    else if (event.key === "ArrowUp")
      setHighlighted(Math.max(highlighted - 1, 0));
    else if (event.key === "Enter") submit();
    else return;
    event.preventDefault();
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="sm:max-w-2xl"
        data-testid="visual-picker"
        onKeyDown={onKeyDown}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description !== undefined && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
          <div
            className="max-h-[50vh] overflow-auto rounded-md border"
            role="listbox"
            aria-label="Visuals"
          >
            {CATALOG.map((candidate, index) => (
              <button
                key={candidate.id}
                type="button"
                role="option"
                ref={(element) => {
                  options.current[index] = element;
                }}
                aria-selected={index === highlighted}
                className={cn(
                  "flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-accent/40",
                  index === highlighted && "bg-selection/15 text-selection",
                )}
                onClick={() => setHighlighted(index)}
                onDoubleClick={submit}
              >
                <span className="font-medium">{candidate.name}</span>
                {candidate.id === current && (
                  <span className="text-[0.625rem] text-muted-foreground">
                    current
                  </span>
                )}
              </button>
            ))}
          </div>
          {definition !== undefined && (
            <div className="grid max-h-[50vh] content-start gap-2 overflow-auto text-xs">
              <p className="font-medium">{definition.name}</p>
              <p className="leading-relaxed text-muted-foreground">
                {definition.description}
              </p>
              <Facts label="Slots">
                {definition.slots.map((slot) => (
                  <li key={slot.key} className="flex gap-2">
                    <span className="w-12 shrink-0">{slot.label}</span>
                    <span className="text-muted-foreground">
                      {slotBinding(slot)}
                    </span>
                  </li>
                ))}
              </Facts>
              {definition.cues.length > 0 && (
                <Facts label="Cues">
                  {definition.cues.map((cue) => (
                    <li key={cue.key} className="flex gap-2">
                      <span className="w-12 shrink-0">{cue.label}</span>
                      <span className="text-muted-foreground">
                        {cue.description}
                      </span>
                    </li>
                  ))}
                </Facts>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={definition === undefined || definition.id === current}
            onClick={submit}
          >
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Facts({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="grid gap-0.5">
      <p className="text-[0.625rem] tracking-wider text-muted-foreground/70 uppercase">
        {label}
      </p>
      <ul className="grid gap-0.5 text-[0.6875rem]">{children}</ul>
    </div>
  );
}

const slotBinding = (slot: SlotDefinition): string =>
  slot.attribute === null
    ? `${slot.kind}, not bound`
    : `${slot.kind}, bound to ${ATTRIBUTES[slot.attribute].label}`;
