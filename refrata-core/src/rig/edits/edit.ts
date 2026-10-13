import type { ByteRange, Encode } from "../encode-rules.ts";
import type {
  ElementDeclaration,
  Mode,
  ParameterDeclaration,
} from "../fixture-type.ts";

/**
 * The edits of a Fixture Type are pure: each takes a Mode (or a type) and
 * returns the next one, or a Refusal saying in a person's words why the
 * change cannot be made. A type is always valid, so an edit fills in what
 * its change needs and refuses what would leave a reference dangling.
 */
export interface Refusal {
  readonly error: string;
}
export type Edited<TValue> = TValue | Refusal;

export const refuse = (error: string): Refusal => ({ error });

export function isRefusal(value: object): value is Refusal {
  return "error" in value;
}

export function withElement(
  mode: Mode,
  key: string,
  element: ElementDeclaration,
): Mode {
  return { ...mode, elements: { ...mode.elements, [key]: element } };
}

export function withParameter(
  mode: Mode,
  elementKey: string,
  attribute: string,
  parameter: ParameterDeclaration,
): Mode {
  const element = mode.elements[elementKey];
  if (element === undefined) return mode;
  return withElement(mode, elementKey, {
    ...element,
    parameters: { ...element.parameters, [attribute]: parameter },
  });
}

/** A record without one key. */
export function without<TValue>(
  record: Readonly<Record<string, TValue>>,
  key: string,
): Record<string, TValue> {
  const { [key]: _gone, ...rest } = record;
  return rest;
}

/** The Element holding `key` among its children; undefined for the root or an unknown key. */
export function parentOf(mode: Mode, key: string): string | undefined {
  return Object.entries(mode.elements).find(([, element]) =>
    element.children.includes(key),
  )?.[0];
}

/** An Element's key and those of everything under it, in tree order. */
export function subtreeKeys(mode: Mode, key: string): string[] {
  return [
    key,
    ...(mode.elements[key]?.children ?? []).flatMap((child) =>
      subtreeKeys(mode, child),
    ),
  ];
}

/** The keys of the Channels that belong to an Element, in wire order. */
export function ownChannels(mode: Mode, element: string): string[] {
  return mode.channels
    .filter((channel) => channel.element === element)
    .map((channel) => channel.key);
}

/** An Encoding with every mention of one Channel swapped for another. */
export function renameInEncode(
  encode: Encode,
  from: string,
  to: string,
): Encode {
  const swap = (key: string): string => (key === from ? to : key);
  if ("scale" in encode) return { scale: swap(encode.scale) };
  if ("color" in encode) return { color: encode.color.map(swap) };
  if ("wheel" in encode)
    return {
      wheel: swap(encode.wheel),
      ...(encode.multiply === undefined
        ? {}
        : { multiply: encode.multiply.map(swap) }),
    };
  if ("multiply" in encode) return { multiply: encode.multiply.map(swap) };
  if ("range" in encode) return { range: swap(encode.range) };
  if ("switch" in encode) return { ...encode, switch: swap(encode.switch) };
  return { ...encode, spread: swap(encode.spread) };
}

/** Why two bytes are not a byte range, or undefined when they are. */
export function rangeProblem(
  bytes: readonly [number, number],
): string | undefined {
  return bytes[0] <= bytes[1]
    ? undefined
    : `A byte range runs low to high, and ${String(bytes[0])} to ${String(bytes[1])} does not.`;
}

export const asRange = (bytes: readonly [number, number]): ByteRange => [
  bytes[0],
  bytes[1],
];
