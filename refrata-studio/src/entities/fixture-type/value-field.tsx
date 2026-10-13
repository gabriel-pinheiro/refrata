import {
  attributeOf,
  isAttributeKey,
  type ParameterDeclaration,
  type ParameterValue,
} from "@refrata/core";

import { Switch } from "@/components/ui/switch";
import { Choice, NumberBox } from "@/inspector/fields/form-inputs";

import { fromHex, toHex } from "./ranges-table";

const round = (value: number): number => Math.round(value * 1000) / 1000;

/**
 * The control for one value of a Parameter, such as its Default or its
 * Highlight: a number in the Attribute's unit, a colour (one of the swatches
 * when the Parameter is on a wheel), one of the options, or a switch.
 */
export function ValueField({
  attribute,
  parameter,
  value,
  label,
  onChange,
}: {
  readonly attribute: string;
  readonly parameter: ParameterDeclaration;
  readonly value: ParameterValue | undefined;
  readonly label: string;
  readonly onChange: (value: ParameterValue) => void;
}) {
  if (!isAttributeKey(attribute)) return null;
  const definition = attributeOf(attribute);
  if (definition.kind === "number") {
    const scale = definition.percent === true ? 100 : 1;
    const unit =
      definition.percent === true ? "%" : (parameter.unit ?? definition.unit);
    return (
      <span className="flex items-center gap-1.5">
        <NumberBox
          label={label}
          className="w-16"
          min={(parameter.min ?? definition.min) * scale}
          max={(parameter.max ?? definition.max) * scale}
          value={round(
            (typeof value === "number" ? value : definition.default) * scale,
          )}
          onChange={(next) => onChange(next / scale)}
        />
        {unit !== undefined && (
          <span className="text-xs text-muted-foreground">{unit}</span>
        )}
      </span>
    );
  }
  if (definition.kind === "boolean")
    return (
      <span className="flex h-6 items-center gap-2 text-xs">
        <Switch
          aria-label={label}
          checked={value === true}
          onCheckedChange={onChange}
        />
        {value === true ? "On" : "Off"}
      </span>
    );
  if (definition.kind === "choice") {
    const options = parameter.options ?? definition.options;
    return (
      <Choice
        value={typeof value === "string" ? value : definition.default}
        options={options.map((option) => ({
          value: option.value,
          label: option.label,
        }))}
        onChange={onChange}
      />
    );
  }
  const color = Array.isArray(value) ? value : definition.default;
  if (parameter.swatches !== undefined) {
    const hex = toHex(color);
    return (
      <Choice
        value={hex}
        placeholder="Black"
        options={[
          { value: "#000000", label: "Black" },
          ...parameter.swatches
            .filter((swatch) => toHex(swatch.color) !== "#000000")
            .map((swatch) => ({
              value: toHex(swatch.color),
              label: swatch.label,
            })),
        ]}
        onChange={(next) => onChange([...fromHex(next), 1])}
      />
    );
  }
  return (
    <span className="flex h-6 items-center gap-2 text-xs">
      <input
        type="color"
        aria-label={label}
        className="h-6 w-9 cursor-pointer rounded-sm border bg-transparent p-0"
        value={toHex(color)}
        onChange={(event) =>
          onChange([...fromHex(event.currentTarget.value), 1])
        }
      />
      <span className="font-mono text-muted-foreground">{toHex(color)}</span>
    </span>
  );
}
