import { useState, type KeyboardEvent, type ReactNode } from "react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface ChoiceOption<Value extends string> {
  readonly value: Value;
  readonly label: string;
  /** Listed but not to be picked now; the form says why beside it. */
  readonly disabled?: boolean;
}

/** One value among named options; shows `placeholder` while the value is none of them. */
export function Choice<Value extends string>({
  value,
  options,
  placeholder = "Choose",
  className,
  onChange,
}: {
  readonly value: Value | null;
  readonly options: readonly ChoiceOption<Value>[];
  readonly placeholder?: string;
  readonly className?: string;
  readonly onChange: (value: Value) => void;
}) {
  const known = options.some((option) => option.value === value);
  return (
    <Select
      value={known ? value : null}
      items={options}
      onValueChange={(next: Value | null) => {
        if (next !== null) onChange(next);
      }}
    >
      <SelectTrigger size="sm" className={cn("w-full min-w-0", className)}>
        <SelectValue
          className="block min-w-0 truncate"
          placeholder={placeholder}
        />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            disabled={option.disabled === true}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** A number typed freely and taken on Enter or on leaving the box, kept within its bounds. */
export function NumberBox({
  value,
  min = 0,
  max = 255,
  label,
  className,
  onChange,
}: {
  readonly value: number;
  readonly min?: number;
  readonly max?: number;
  readonly label: string;
  readonly className?: string;
  readonly onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const commit = (): void => {
    if (draft === undefined) return;
    const typed = Number(draft.replace(",", "."));
    if (draft.trim() !== "" && Number.isFinite(typed))
      onChange(Math.min(max, Math.max(min, typed)));
    setDraft(undefined);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Enter") commit();
    else if (event.key === "Escape") setDraft(undefined);
  };
  return (
    <Input
      aria-label={label}
      inputMode="decimal"
      className={cn("h-6 px-1.5 text-center tabular-nums", className)}
      value={draft ?? String(value)}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
    />
  );
}

/** A line of text taken on Enter or on leaving the box. */
export function TextBox({
  value,
  label,
  placeholder,
  className,
  onChange,
}: {
  readonly value: string;
  readonly label: string;
  readonly placeholder?: string;
  readonly className?: string;
  readonly onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const commit = (): void => {
    if (draft !== undefined && draft !== value) onChange(draft);
    setDraft(undefined);
  };
  return (
    <Input
      aria-label={label}
      placeholder={placeholder}
      className={cn("h-6 min-w-0", className)}
      value={draft ?? value}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
        else if (event.key === "Escape") setDraft(undefined);
      }}
    />
  );
}

/** One choice among a few, drawn as joined buttons. */
export function Pills<Value extends string>({
  value,
  options,
  onChange,
  trailing,
}: {
  readonly value: Value;
  readonly options: readonly ChoiceOption<Value>[];
  readonly onChange: (value: Value) => void;
  readonly trailing?: ReactNode;
}) {
  return (
    <div className="flex h-6 w-fit max-w-full items-center gap-0.5 overflow-x-auto rounded-md bg-muted p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cn(
            "h-full shrink-0 rounded-sm px-2 text-xs text-muted-foreground hover:text-foreground",
            option.value === value && "bg-background text-foreground shadow-sm",
          )}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
      {trailing}
    </div>
  );
}
