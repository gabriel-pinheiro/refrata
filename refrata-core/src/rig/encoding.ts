import type { Color, ParameterValue, ParameterValues } from "../parameters.ts";
import type { AttributeKey } from "./attributes.ts";
import type { Element } from "./elements.ts";
import {
  channelSlot,
  footprintOf,
  type ByteRange,
  type Mode,
} from "./fixture-type.ts";
import { brightnessOf, nearestSwatch } from "./gamut.ts";

/**
 * Encoding: the one place Parameter Values become bytes, and it runs one
 * way. Channels start at their rest byte; `scale`, `color`, `wheel`,
 * `range` and `switch` write into them; `spread` then overwrites a Channel
 * its selector wrote, when its number is above zero; `multiply` last
 * scales what was written. Multi-byte Channels are big-endian across their
 * bytes, and a byte range lands in the high byte of a wide Channel.
 */
export type ResolvedValues = ReadonlyMap<string, ParameterValues>;

interface Slot {
  readonly offset: number;
  readonly width: number;
}

/** The Mode's bytes for one Fixture, `footprint` long, from each Element's resolved values by Element key. */
export function encodeMode(
  mode: Mode,
  elements: readonly Element[],
  values: (elementKey: string) => ParameterValues | undefined,
): Uint8Array {
  const bytes = new Uint8Array(footprintOf(mode));
  const slots = new Map<string, Slot>();
  for (const channel of mode.channels) {
    const slot = channelSlot(mode, channel.key);
    if (slot === undefined) continue;
    slots.set(channel.key, slot);
    writeRaw(bytes, slot, channel.default);
  }
  const slotOf = (key: string): Slot | undefined => slots.get(key);
  const spreads: (() => void)[] = [];
  const multipliers: {
    readonly channels: readonly string[];
    readonly factor: number;
  }[] = [];
  for (const element of elements) {
    const own = values(element.key);
    const valueOf = (key: string): ParameterValue | undefined => {
      const parameter = element.parameters[key as AttributeKey];
      return parameter === undefined
        ? undefined
        : (own?.[key] ?? parameter.definition.default);
    };
    for (const [key, parameter] of Object.entries(element.parameters)) {
      const value = valueOf(key);
      if (value === undefined) continue;
      const encode = parameter.encode;
      if ("scale" in encode) {
        const slot = slotOf(encode.scale);
        if (slot !== undefined && parameter.definition.kind === "number")
          writeLevel(bytes, slot, normalize(parameter.definition, value));
      } else if ("color" in encode) {
        const [r, g, b, w] = emitters(value);
        const levels =
          encode.color.length === 4 ? [r, g, b, w] : [r + w, g + w, b + w];
        encode.color.forEach((channelKey, index) => {
          const slot = slotOf(channelKey);
          if (slot !== undefined) writeLevel(bytes, slot, levels[index] ?? 0);
        });
      } else if ("wheel" in encode) {
        const slot = slotOf(encode.wheel);
        const swatch = Array.isArray(value)
          ? nearestSwatch(value as Color, parameter.swatches ?? [])
          : undefined;
        if (slot !== undefined && swatch !== undefined)
          writeRaw(bytes, slot, startOf(swatch.bytes));
        if (encode.multiply !== undefined && Array.isArray(value))
          multipliers.push({
            channels: encode.multiply,
            factor: brightnessOf(value as Color),
          });
      } else if ("range" in encode) {
        const slot = slotOf(encode.range);
        const option = parameter.options?.find(
          (candidate) => candidate.value === value,
        );
        if (slot !== undefined && option !== undefined)
          writeRaw(bytes, slot, startOf(option.bytes));
      } else if ("switch" in encode) {
        const slot = slotOf(encode.switch);
        if (slot !== undefined)
          writeRaw(
            bytes,
            slot,
            startOf(value === true ? encode.on : encode.off),
          );
      } else if ("spread" in encode) {
        const slot = slotOf(encode.spread);
        const level =
          parameter.definition.kind === "number"
            ? normalize(parameter.definition, value)
            : 0;
        const range = spreadRange(encode.ranges, valueOf(encode.by));
        if (slot !== undefined && range !== undefined && level > 0)
          spreads.push(() => writeRaw(bytes, slot, alongRange(range, level)));
      } else if (parameter.definition.kind === "number") {
        multipliers.push({
          channels: encode.multiply,
          factor: normalize(parameter.definition, value),
        });
      }
    }
  }
  for (const spread of spreads) spread();
  for (const { channels, factor } of multipliers) {
    for (const channelKey of channels) {
      const slot = slotOf(channelKey);
      if (slot === undefined) continue;
      writeLevel(bytes, slot, readLevel(bytes, slot) * factor);
    }
  }
  return bytes;
}

/** The range a `spread` rule takes for its selector's current value: an option value, or `on` and `off` for a boolean. */
function spreadRange(
  ranges: Readonly<Record<string, ByteRange>>,
  selector: ParameterValue | undefined,
): ByteRange | undefined {
  if (typeof selector === "boolean") return ranges[selector ? "on" : "off"];
  if (typeof selector === "string") return ranges[selector];
  return undefined;
}

/**
 * The byte a range writes: its start, the value the chart names, which is
 * what grandMA3 and GDTF send for a channel set. The middle was tried and
 * put a prism in at 49 of an "off" band of 0 to 99.
 */
function startOf([low]: ByteRange): number {
  return low;
}

/** A level in (0, 1] placed along a byte range, low to high. */
function alongRange([low, high]: ByteRange, level: number): number {
  return low + Math.round(clamp(level) * (high - low));
}

/** A number's place in its range, 0 to 1. */
function normalize(
  definition: { readonly min: number; readonly max: number },
  value: ParameterValue,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  const span = definition.max - definition.min;
  if (span <= 0) return 0;
  return clamp((value - definition.min) / span);
}

/**
 * Red, green, blue and the white to extract: the minimum of the three,
 * subtracted from them, so an RGBW fixture shows the same hue at more
 * output and an RGB one adds it back. Alpha is ignored.
 */
function emitters(
  value: ParameterValue,
): readonly [number, number, number, number] {
  if (!Array.isArray(value)) return [0, 0, 0, 0];
  const [r, g, b] = value as Color;
  const w = Math.min(r, g, b);
  return [clamp(r - w), clamp(g - w), clamp(b - w), clamp(w)];
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Writes a 0..1 level across the Channel's bytes, big-endian. */
function writeLevel(bytes: Uint8Array, slot: Slot, level: number): void {
  const max = 2 ** (8 * slot.width) - 1;
  writeWord(bytes, slot, Math.round(clamp(level) * max));
}

/** Writes one byte value into the Channel's high byte, the rest 0. */
function writeRaw(bytes: Uint8Array, slot: Slot, byte: number): void {
  writeWord(bytes, slot, byte * 256 ** (slot.width - 1));
}

function writeWord(bytes: Uint8Array, slot: Slot, word: number): void {
  let raw = word;
  for (let index = slot.width - 1; index >= 0; index -= 1) {
    bytes[slot.offset + index] = raw & 0xff;
    raw = Math.floor(raw / 256);
  }
}

function readLevel(bytes: Uint8Array, slot: Slot): number {
  const max = 2 ** (8 * slot.width) - 1;
  let raw = 0;
  for (let index = 0; index < slot.width; index += 1)
    raw = raw * 256 + (bytes[slot.offset + index] ?? 0);
  return raw / max;
}

/** The default value of every Parameter of an Element, keyed by Attribute. */
export function defaultsOf(element: Element): ParameterValues {
  return Object.fromEntries(
    Object.entries(element.parameters).map(([key, parameter]) => [
      key as AttributeKey,
      parameter.definition.default,
    ]),
  );
}
