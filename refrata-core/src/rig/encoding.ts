import type { Color, ParameterValue, ParameterValues } from "../parameters.ts";
import type { AttributeKey } from "./attributes.ts";
import type { Element } from "./elements.ts";
import { footprintOf, type Mode } from "./fixture-type.ts";

/**
 * Encoding: the one place Parameter Values become bytes, and it runs one
 * way. Channels start at their rest byte; `scale` and `color` write into
 * them; `multiply` then scales what was written. Multi-byte Channels are
 * big-endian across their bytes.
 */
export type ResolvedValues = ReadonlyMap<string, ParameterValues>;

/** The Mode's bytes for one Fixture, `footprint` long, from each Element's resolved values by Element key. */
export function encodeMode(
  mode: Mode,
  elements: readonly Element[],
  values: (elementKey: string) => ParameterValues | undefined,
): Uint8Array {
  const footprint = footprintOf(mode);
  const bytes = new Uint8Array(footprint);
  const offsets = new Map<
    string,
    { readonly offset: number; readonly width: number }
  >();
  let offset = 0;
  for (const channel of mode.channels) {
    offsets.set(channel.key, { offset, width: channel.bytes });
    writeChannel(bytes, offset, channel.bytes, channel.default / 255);
    offset += channel.bytes;
  }
  const multipliers: {
    readonly channels: readonly string[];
    readonly factor: number;
  }[] = [];
  for (const element of elements) {
    const own = values(element.key);
    for (const [key, parameter] of Object.entries(element.parameters)) {
      const value = own?.[key] ?? parameter.definition.default;
      const encode = parameter.encode;
      if ("scale" in encode) {
        const slot = offsets.get(encode.scale);
        if (slot !== undefined && parameter.definition.kind === "number")
          writeChannel(
            bytes,
            slot.offset,
            slot.width,
            normalize(parameter.definition, value),
          );
      } else if ("color" in encode) {
        const [r, g, b, w] = emitters(value);
        const levels =
          encode.color.length === 4 ? [r, g, b, w] : [r + w, g + w, b + w];
        encode.color.forEach((channelKey, index) => {
          const slot = offsets.get(channelKey);
          if (slot !== undefined)
            writeChannel(bytes, slot.offset, slot.width, levels[index] ?? 0);
        });
      } else if (parameter.definition.kind === "number") {
        multipliers.push({
          channels: encode.multiply,
          factor: normalize(parameter.definition, value),
        });
      }
    }
  }
  for (const { channels, factor } of multipliers) {
    for (const channelKey of channels) {
      const slot = offsets.get(channelKey);
      if (slot === undefined) continue;
      writeChannel(
        bytes,
        slot.offset,
        slot.width,
        readChannel(bytes, slot.offset, slot.width) * factor,
      );
    }
  }
  return bytes;
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

/** Writes a 0..1 level across `width` bytes, big-endian. */
function writeChannel(
  bytes: Uint8Array,
  offset: number,
  width: number,
  level: number,
): void {
  const max = 2 ** (8 * width) - 1;
  let raw = Math.round(clamp(level) * max);
  for (let index = width - 1; index >= 0; index -= 1) {
    bytes[offset + index] = raw & 0xff;
    raw = Math.floor(raw / 256);
  }
}

function readChannel(bytes: Uint8Array, offset: number, width: number): number {
  const max = 2 ** (8 * width) - 1;
  let raw = 0;
  for (let index = 0; index < width; index += 1)
    raw = raw * 256 + (bytes[offset + index] ?? 0);
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
