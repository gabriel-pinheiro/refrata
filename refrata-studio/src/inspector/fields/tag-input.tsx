import { normaliseTag, type TagUse } from "@refrata/core";
import { useState } from "react";

import { Input } from "@/components/ui/input";

/** How many Tags are offered under the input at once. */
const SUGGESTIONS = 8;

/**
 * Where a Tag is typed. What is typed is normalised as it goes ("Truss
 * Left" adds `truss-left`, shown under the input when it differs), Enter or
 * a comma adds it, and the Tags already present in the rig that match are
 * offered below to click. A Rule may also name a Fixture Type key, the one
 * Tag with a slash.
 */
export function TagInput({
  label,
  placeholder,
  uses,
  exclude,
  typeKeys = false,
  onAdd,
}: {
  readonly label: string;
  readonly placeholder: string;
  /** Every Tag present in the rig, to complete from. */
  readonly uses: readonly TagUse[];
  /** Tags already here, never offered. */
  readonly exclude: readonly string[];
  /** Whether a Fixture Type key (with its slash) may be typed and offered. */
  readonly typeKeys?: boolean;
  readonly onAdd: (tag: string) => void;
}) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const tag = typeKeys
    ? normaliseTag(text)
    : normaliseTag(text.replaceAll("/", " "));
  const offered = uses
    .filter(
      (use) =>
        !exclude.includes(use.tag) &&
        (typeKeys || !use.tag.includes("/")) &&
        use.tag.includes(tag),
    )
    .sort(
      (a, b) =>
        Number(b.tag.startsWith(tag)) - Number(a.tag.startsWith(tag)) ||
        Number(b.person) - Number(a.person),
    )
    .slice(0, SUGGESTIONS);
  const add = (value: string): void => {
    if (value === "" || exclude.includes(value)) return;
    onAdd(value);
    setText("");
  };
  return (
    <div className="grid gap-1">
      <Input
        aria-label={label}
        className="h-6 text-xs"
        placeholder={placeholder}
        value={text}
        onChange={(event) => setText(event.currentTarget.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            add(tag);
          } else if (event.key === "Escape") setText("");
        }}
      />
      {tag !== "" && tag !== text && (
        <span className="text-[0.625rem] text-muted-foreground">
          Enter adds <span className="font-mono text-foreground">{tag}</span>
        </span>
      )}
      {(focused || text !== "") && offered.length > 0 && (
        <div className="flex flex-wrap gap-1" aria-label="Tags in the rig">
          {offered.map((use) => (
            <button
              key={use.tag}
              type="button"
              className="max-w-full truncate rounded-full border border-dashed px-2 text-[0.625rem]/4 text-muted-foreground hover:border-solid hover:text-foreground"
              title={`${String(use.count)} ${use.count === 1 ? "Element" : "Elements"}`}
              // Before the input's blur, which would hide the offer.
              onMouseDown={(event) => {
                event.preventDefault();
                add(use.tag);
              }}
            >
              {use.tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
