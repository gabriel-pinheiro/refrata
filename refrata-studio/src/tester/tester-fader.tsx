import { useState, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useLatestWins } from "@/lib/use-latest-wins";
import { cn } from "@/lib/utils";

import type { TesterChannel } from "./tester-channels";

/**
 * One channel of the DMX Tester: its number, the name a patched Fixture
 * gives it, a vertical fader and a typed byte. A released channel shows
 * dimmed with a Take button; Release under a held one lets it go.
 */
export function TesterFader({
  entry,
  onChange,
}: {
  readonly entry: TesterChannel;
  readonly onChange: (value: number | null) => void;
}) {
  const [dragged, setDragged] = useState<number | undefined>(undefined);
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const send = useLatestWins((value: number) => {
    onChange(value);
    return Promise.resolve();
  });
  const released = entry.value === null;
  const shown = dragged ?? entry.value ?? 0;
  const commit = (cancel: boolean): void => {
    if (!cancel && draft !== undefined) {
      const typed = Number.parseInt(draft.trim(), 10);
      if (Number.isInteger(typed)) onChange(Math.min(255, Math.max(0, typed)));
    }
    setDraft(undefined);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Enter") commit(false);
    else if (event.key === "Escape") commit(true);
    else return;
    event.preventDefault();
  };
  return (
    <div
      className={cn(
        "flex w-16 flex-col items-center gap-1 rounded-md border p-1.5",
        released && "opacity-60",
      )}
    >
      <span className="text-xs font-medium tabular-nums">
        {String(entry.channel)}
      </span>
      <span
        className="h-3 w-full truncate text-center text-[0.5625rem] text-muted-foreground"
        title={entry.name}
      >
        {entry.name === undefined ? "" : entry.name.split(" · ")[1]}
      </span>
      <div className="h-40">
        <Slider
          aria-label={`Channel ${String(entry.channel)}`}
          orientation="vertical"
          min={0}
          max={255}
          step={1}
          value={shown}
          disabled={released}
          onValueChange={(next) => {
            const value = typeof next === "number" ? next : (next[0] ?? 0);
            setDragged(value);
            send(value);
          }}
          onValueCommitted={() => setDragged(undefined)}
        />
      </div>
      <Input
        aria-label={`Channel ${String(entry.channel)} byte`}
        className="h-5 w-full px-1 text-center text-[0.6875rem] tabular-nums"
        value={draft ?? (released ? "" : String(shown))}
        placeholder={released ? "–" : undefined}
        onFocus={() => setDraft(released ? "" : String(shown))}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onBlur={() => commit(false)}
        onKeyDown={onKeyDown}
      />
      <Button
        variant="ghost"
        size="xs"
        className="h-5 w-full px-0 text-[0.625rem]"
        onClick={() => onChange(released ? 0 : null)}
      >
        {released ? "Take" : "Release"}
      </Button>
    </div>
  );
}
