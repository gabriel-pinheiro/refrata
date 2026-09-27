import { useRef, useState } from "react";

import { useLatestWins } from "@/lib/use-latest-wins";

import type { AimValue } from "./aim-nudge";

/**
 * An Aim being edited faster than the runtime replies: nudges from the
 * keys or the pad move a held value, shown at once and sent one at a time
 * with the newest winning, each send carrying every axis moved since the
 * hold began so a pan nudge waiting is not lost to a tilt one. The hold
 * ends when the last send settles; the runtime sends a caller's own delta
 * before its reply, so the document already shows the value by then.
 */
export function useAimEdit(
  current: AimValue,
  onEdit: (value: AimValue) => Promise<unknown>,
): {
  /** The document's value, or the held one while a send is on its way. */
  readonly shown: AimValue;
  /** The value as the next event should build on, held edits included, between renders too. */
  readonly latest: () => AimValue;
  /** Writes these axes, keeping the others as they are. */
  readonly write: (value: AimValue) => void;
} {
  const [held, setHeld] = useState<AimValue | undefined>(undefined);
  // The held value as the next event sees it, before React renders again.
  const heldNow = useRef<AimValue | undefined>(undefined);
  const send = useLatestWins(async (value: AimValue) => {
    await onEdit(value);
    if (heldNow.current === value) {
      heldNow.current = undefined;
      setHeld(undefined);
    }
  });
  return {
    shown: { ...current, ...held },
    latest: () => ({ ...current, ...heldNow.current }),
    write: (value) => {
      const next = { ...heldNow.current, ...value };
      heldNow.current = next;
      setHeld(next);
      send(next);
    },
  };
}
