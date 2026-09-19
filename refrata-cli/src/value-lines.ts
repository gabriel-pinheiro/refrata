import {
  attributeDefinition,
  isAttributeKey,
  type ParameterValue,
} from "@refrata/core";

/** How a number says what it is: a percent of 0 to 1, or a unit after it. */
export interface NumberStyle {
  readonly percent?: boolean;
  readonly unit?: string;
}

export const percent = (value: number): string =>
  `${String(Math.round(value * 100))}%`;

export function hex(color: readonly number[]): string {
  return `#${color
    .slice(0, 3)
    .map((channel) =>
      Math.round(Math.min(1, Math.max(0, channel)) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** A value as a person reads it: 40%, 12 Hz, #00ff00, on, open. */
export function formatValue(
  value: ParameterValue,
  style: NumberStyle | undefined,
): string {
  if (Array.isArray(value)) return hex(value);
  if (typeof value === "boolean") return value ? "on" : "off";
  if (typeof value !== "number" || style === undefined) return String(value);
  if (style.percent === true) return percent(value);
  const text = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return style.unit === undefined ? text : `${text} ${style.unit}`;
}

/** A row's value in its Attribute's units: 40%, 12 Hz, #00ff00, open. */
export function formatRowValue(
  attribute: string,
  value: ParameterValue,
): string {
  const definition = isAttributeKey(attribute)
    ? attributeDefinition(attribute)
    : undefined;
  return formatValue(
    value,
    definition?.kind === "number" ? definition : undefined,
  );
}
