import {
  ATTRIBUTES,
  isAttributeKey,
  type AttributeFamily,
} from "./attributes.ts";
import { encodedChannels } from "./encode-rules.ts";
import type { Mode, ParameterDeclaration } from "./fixture-type.ts";
import { nameFromKey } from "./keys.ts";
import { ruleOf, RULES, type EncodeRule } from "./rules.ts";

/**
 * A Mode as a manual's DMX chart prints it: its Channels in wire order,
 * each with its place in the Footprint, the Parameters that write it and
 * the byte ranges on it. The Fixture Editor and the CLI both draw this.
 */

/** A run of bytes on a Channel and what it does. */
export interface Segment {
  readonly from: number;
  readonly to: number;
  readonly label: string;
  /** The Element and Attribute key of the Parameter that owns the range. */
  readonly element: string;
  readonly attribute: string;
  /** That Parameter's label, such as "Gobo shake". */
  readonly parameter: string;
  readonly kind: "scale" | "mix" | "swatch" | "option" | "switch" | "spread";
  /** Red, green and blue, 0 to 1, for a swatch or a colour mix Channel. */
  readonly color?: readonly [number, number, number];
}

/** A Parameter that writes or scales a Channel. */
export interface Writer {
  readonly element: string;
  readonly attribute: string;
  readonly label: string;
  readonly family: AttributeFamily;
  readonly rule: EncodeRule;
}

/** One Channel of a Mode with everything a chart shows beside it. */
export interface ChannelRow {
  readonly key: string;
  readonly name: string;
  /** The first place it takes in the Footprint, from 1: the one number a Channel has. */
  readonly address: number;
  readonly bytes: number;
  readonly element: string;
  readonly elementName: string;
  /** The byte it rests at while no Parameter writes it. */
  readonly rest: number;
  readonly writers: readonly Writer[];
  readonly segments: readonly Segment[];
}

const MIX = [
  ["Red", [1, 0.16, 0.16]],
  ["Green", [0.16, 0.86, 0.27]],
  ["Blue", [0.24, 0.35, 1]],
  ["White", [0.94, 0.94, 0.94]],
] as const;

/** An Attribute's label and family, or a stand-in for a key the vocabulary lacks. */
export function attributeInfo(key: string): {
  readonly label: string;
  readonly family: AttributeFamily;
  readonly kind: "number" | "color" | "choice" | "boolean";
} {
  return isAttributeKey(key)
    ? ATTRIBUTES[key]
    : { label: nameFromKey(key), family: "control", kind: "number" };
}

/** The values a `spread` can hold a range for: the followed Parameter's options, or off and on. */
export function followedValues(
  by: string,
  followed: ParameterDeclaration | undefined,
): readonly { readonly value: string; readonly label: string }[] {
  if (attributeInfo(by).kind === "boolean")
    return [
      { value: "off", label: "Off" },
      { value: "on", label: "On" },
    ];
  return (followed?.options ?? []).map(({ value, label }) => ({
    value,
    label,
  }));
}

/** The byte ranges one Parameter claims, by Channel key. */
function claimed(
  element: string,
  attribute: string,
  parameter: ParameterDeclaration,
  siblings: Readonly<Record<string, ParameterDeclaration>>,
): Map<string, Segment[]> {
  const label = attributeInfo(attribute).label;
  const base = { element, attribute, parameter: label };
  const out = new Map<string, Segment[]>();
  const encode = parameter.encode;
  if ("scale" in encode)
    out.set(encode.scale, [
      { ...base, from: 0, to: 255, label, kind: "scale" },
    ]);
  else if ("color" in encode)
    encode.color.forEach((channel, index) => {
      const [text, color] = MIX[index] ?? MIX[3];
      out.set(channel, [
        { ...base, from: 0, to: 255, label: text, kind: "mix", color },
      ]);
    });
  else if ("wheel" in encode)
    out.set(
      encode.wheel,
      (parameter.swatches ?? []).map((swatch) => ({
        ...base,
        from: swatch.bytes[0],
        to: swatch.bytes[1],
        label: swatch.label,
        kind: "swatch",
        color: swatch.color,
      })),
    );
  else if ("range" in encode)
    out.set(
      encode.range,
      (parameter.options ?? []).map((option) => ({
        ...base,
        from: option.bytes[0],
        to: option.bytes[1],
        label: option.label,
        kind: "option",
      })),
    );
  else if ("switch" in encode)
    out.set(
      encode.switch,
      (["off", "on"] as const).map((state) => ({
        ...base,
        from: encode[state][0],
        to: encode[state][1],
        label: state === "on" ? "On" : "Off",
        kind: "switch",
      })),
    );
  else if ("spread" in encode) {
    const values = followedValues(encode.by, siblings[encode.by]);
    out.set(
      encode.spread,
      Object.entries(encode.ranges).map(([value, bytes]) => ({
        ...base,
        from: bytes[0],
        to: bytes[1],
        label:
          values.find((each) => each.value === value)?.label ??
          nameFromKey(value),
        kind: "spread",
      })),
    );
  }
  return out;
}

/** The Channel Layout of a Mode in wire order, each Channel with its Parameters and byte ranges. */
export function channelRows(mode: Mode): ChannelRow[] {
  const writers = new Map<string, Writer[]>();
  const segments = new Map<string, Segment[]>();
  for (const [elementKey, element] of Object.entries(mode.elements))
    for (const [key, parameter] of Object.entries(element.parameters)) {
      const { label, family } = attributeInfo(key);
      for (const channel of encodedChannels(parameter.encode))
        writers.set(channel, [
          ...(writers.get(channel) ?? []),
          {
            element: elementKey,
            attribute: key,
            label,
            family,
            rule: ruleOf(parameter.encode),
          },
        ]);
      for (const [channel, runs] of claimed(
        elementKey,
        key,
        parameter,
        element.parameters,
      ))
        segments.set(channel, [...(segments.get(channel) ?? []), ...runs]);
    }
  let address = 1;
  return mode.channels.map((channel) => {
    const row: ChannelRow = {
      key: channel.key,
      name: nameFromKey(channel.key),
      address,
      bytes: channel.bytes,
      element: channel.element,
      elementName: mode.elements[channel.element]?.name ?? channel.element,
      rest: channel.default,
      writers: writers.get(channel.key) ?? [],
      segments: (segments.get(channel.key) ?? []).sort(
        (a, b) => a.from - b.from,
      ),
    };
    address += channel.bytes;
    return row;
  });
}

/** "9" or "1–2": where a Channel sits in the Footprint. */
export function addressText(
  row: Pick<ChannelRow, "address" | "bytes">,
): string {
  return row.bytes === 1
    ? String(row.address)
    : `${String(row.address)}–${String(row.address + row.bytes - 1)}`;
}

/** "9 Gobo": a Channel by its place and its name, as every list and message names it. */
export function channelText(row: ChannelRow): string {
  return `${addressText(row)} ${row.name}`;
}

/** The same for a Channel key of a Mode; the key itself when the Mode lacks it. */
export function channelTextOf(mode: Mode, key: string): string {
  const row = channelRows(mode).find((each) => each.key === key);
  return row === undefined ? key : channelText(row);
}

/** "Dimmer, multiply": a Writer in a few words. */
export function writerText(writer: Writer): string {
  return `${writer.label}, ${RULES[writer.rule].label.toLowerCase()}`;
}

/** The byte that picks a range: the most significant of a wide Channel's bytes. */
export function topByte(bytes: number, value: number): number {
  return Math.floor(value / 256 ** (bytes - 1));
}

/** A Channel's value as the bytes it puts on the wire, most significant first. */
export function wireBytes(bytes: number, value: number): number[] {
  return Array.from(
    { length: bytes },
    (_, index) => Math.floor(value / 256 ** (bytes - 1 - index)) % 256,
  );
}

/** The named range a Channel's value sits in; a continuous value is in none. */
export function segmentAt(row: ChannelRow, value: number): Segment | undefined {
  const byte = topByte(row.bytes, value);
  return row.segments.find(
    (segment) =>
      segment.kind !== "scale" &&
      segment.kind !== "mix" &&
      byte >= segment.from &&
      byte <= segment.to,
  );
}

/** Whether a byte range overlaps another of the same list. */
export function rangeClashes(
  ranges: readonly (readonly [number, number] | undefined)[],
  index: number,
): boolean {
  const own = ranges[index];
  if (own === undefined) return false;
  return ranges.some(
    (other, at) =>
      at !== index &&
      other !== undefined &&
      own[0] <= other[1] &&
      other[0] <= own[1],
  );
}
