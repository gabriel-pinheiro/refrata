import { z } from "zod";

const Key = z.string().regex(/^[a-z0-9][a-z0-9-]*$/);
const Byte = z.number().int().min(0).max(255);
/** A run of bytes on a one-byte Channel, low to high, both included. */
export const ByteRangeSchema = z
  .tuple([Byte, Byte])
  .refine(([low, high]) => low <= high, "must run low to high");
export type ByteRange = z.infer<typeof ByteRangeSchema>;

/**
 * How a Parameter reaches Channels. `scale` writes a number across one
 * Channel's bytes; `color` writes a color to red, green and blue Channels
 * and an optional fourth white Channel (white extracted as the minimum and
 * subtracted from the three); `multiply` scales the bytes of other Channels
 * by a number that has no Channel of its own (a virtual dimmer); `wheel`
 * writes a color as the byte range of its nearest swatch and lets the
 * colour's brightness multiply the listed Channels; `range` writes a
 * choice as its option's byte range; `switch` writes a boolean as one of
 * two ranges; `spread` writes a number above zero over a byte range chosen
 * by another Parameter of the same Element, on the Channel that Parameter
 * writes, and leaves the Channel alone at zero (a gobo's shake, a prism's
 * rotation).
 */
export const EncodeSchema = z.union([
  z.object({ scale: Key }).strict(),
  z.object({ color: z.array(Key).min(3).max(4) }).strict(),
  z.object({ multiply: z.array(Key).min(1) }).strict(),
  z.object({ wheel: Key, multiply: z.array(Key).optional() }).strict(),
  z.object({ range: Key }).strict(),
  z.object({ switch: Key, on: ByteRangeSchema, off: ByteRangeSchema }).strict(),
  z
    .object({
      spread: Key,
      by: Key,
      ranges: z.record(z.string(), ByteRangeSchema),
    })
    .strict(),
]);
export type Encode = z.infer<typeof EncodeSchema>;

/** The Channels an Encoding rule writes or reads. */
export function encodedChannels(encode: Encode): readonly string[] {
  if ("scale" in encode) return [encode.scale];
  if ("color" in encode) return encode.color;
  if ("wheel" in encode) return [encode.wheel, ...(encode.multiply ?? [])];
  if ("multiply" in encode) return encode.multiply;
  if ("range" in encode) return [encode.range];
  if ("switch" in encode) return [encode.switch];
  if ("spread" in encode) return [encode.spread];
  return [];
}
