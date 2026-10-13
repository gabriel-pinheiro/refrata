import type { ParameterDeclaration } from "@refrata/core";

import type { ChoiceOption } from "@/inspector/fields/form-inputs";
import { cn } from "@/lib/utils";

import type { Scope } from "./scope";

/** What every rule's fields are handed. */
export interface EncodeProps {
  readonly scope: Scope;
  readonly element: string;
  readonly attribute: string;
  readonly parameter: ParameterDeclaration;
  /** The Element's own Channels, the only ones its Parameters may write. */
  readonly channels: readonly ChoiceOption<string>[];
  /** The probe's byte on a Channel, when the probe holds a Fixture. */
  readonly current: (channelKey: string) => number | undefined;
  /** Changes the Encoding: the fields of `type.encoding.set`. */
  readonly encode: (change: object) => void;
  /** Runs another command on this Parameter, such as `type.option.add`. */
  readonly run: (name: string, payload?: object) => void;
}

/** Channels as chips, any number of them on. */
export function ChannelToggles({
  options,
  values,
  onChange,
}: {
  readonly options: readonly ChoiceOption<string>[];
  readonly values: readonly string[];
  readonly onChange: (values: string[]) => void;
}) {
  if (options.length === 0)
    return <span className="text-xs text-muted-foreground">No Channel</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((option) => {
        const on = values.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={on}
            className={cn(
              "h-6 rounded-md border px-2 text-xs text-muted-foreground hover:text-foreground",
              on && "border-primary bg-primary/20 text-foreground",
            )}
            onClick={() =>
              onChange(
                on
                  ? values.filter((value) => value !== option.value)
                  : [...values, option.value],
              )
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
