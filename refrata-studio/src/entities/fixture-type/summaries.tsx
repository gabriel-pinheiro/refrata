import {
  attributeInfo,
  attributeOf,
  channelText,
  encodedChannels,
  isAttributeKey,
  type AttributeFamily,
  type ChannelRow,
  type ParameterDeclaration,
  type ParameterValue,
} from "@refrata/core";

import type { Scope } from "./scope";

/** A colour of components from 0 to 1 as CSS. */
export const css = (color: readonly number[]): string =>
  `rgb(${color
    .slice(0, 3)
    .map((part) => String(Math.round(part * 255)))
    .join(" ")})`;

/** The dot each Attribute family is marked with. */
export const FAMILY_COLOR: Record<AttributeFamily, string> = {
  intensity: "oklch(0.86 0.12 95)",
  color: "oklch(0.7 0.19 20)",
  position: "oklch(0.7 0.13 235)",
  beam: "oklch(0.75 0.13 165)",
  gobo: "oklch(0.68 0.15 300)",
  control: "oklch(0.62 0.02 264)",
};

/** "9 Gobo" or "1 Red, 2 Green, 3 Blue": the Channels a Parameter touches. */
export function channelsText(
  rows: readonly ChannelRow[],
  parameter: ParameterDeclaration,
): string {
  const keys = encodedChannels(parameter.encode);
  if (keys.length === 0) return "No Channel";
  return keys
    .map((key) => {
      const row = rows.find((each) => each.key === key);
      return row === undefined ? key : channelText(row);
    })
    .join(", ");
}

/** What is picked, in words: "Channel 9 Gobo", "Gobo of Beam Moving Head". */
export function pickTitle(scope: Scope): string {
  const pick = scope.pick;
  if (pick === undefined) return "Nothing picked";
  switch (pick.kind) {
    case "type":
      return `${scope.type.manufacturer} ${scope.type.model}`;
    case "mode":
      return `Mode ${scope.mode.name}`;
    case "channel": {
      const row = scope.rows.find((each) => each.key === pick.key);
      return row === undefined ? "Channel" : `Channel ${channelText(row)}`;
    }
    case "element":
      return `Element ${scope.mode.elements[pick.key]?.name ?? pick.key}`;
    case "parameter":
      return `${attributeInfo(pick.attribute).label} of ${scope.mode.elements[pick.element]?.name ?? pick.element}`;
    case "action":
      return `Action ${scope.mode.actions[pick.key]?.name ?? pick.key}`;
  }
}

/** One value of a Parameter as a person reads it: a percentage, a colour, an option's label, on or off. */
export function ValueText({
  attribute,
  parameter,
  value,
}: {
  readonly attribute: string;
  readonly parameter: ParameterDeclaration;
  readonly value: ParameterValue | undefined;
}) {
  if (value === undefined || !isAttributeKey(attribute))
    return <span className="text-muted-foreground/60">none</span>;
  const definition = attributeOf(attribute);
  if (typeof value === "boolean") return <>{value ? "On" : "Off"}</>;
  if (typeof value === "number")
    return (
      <>
        {definition.kind === "number" && definition.percent === true
          ? `${String(Math.round(value * 100))}%`
          : `${String(value)}${parameter.unit ?? (definition.kind === "number" ? (definition.unit ?? "") : "")}`}
      </>
    );
  if (typeof value === "string")
    return (
      <>
        {parameter.options?.find((option) => option.value === value)?.label ??
          value}
      </>
    );
  return (
    <span
      className="inline-block size-3 rounded-full border align-middle"
      style={{ background: css(value) }}
    />
  );
}
