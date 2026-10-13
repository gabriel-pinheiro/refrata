import { useState } from "react";

/** Notes, several lines, taken on leaving the box. */
export function NotesBox({
  label,
  value,
  placeholder,
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly placeholder?: string;
  readonly onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState<string | undefined>(undefined);
  return (
    <textarea
      aria-label={label}
      className="min-h-14 w-full rounded-md border border-input bg-input/30 px-2 py-1 text-xs"
      placeholder={placeholder}
      value={draft ?? value}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={() => {
        if (draft !== undefined && draft !== value) onChange(draft);
        setDraft(undefined);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") setDraft(undefined);
      }}
    />
  );
}
