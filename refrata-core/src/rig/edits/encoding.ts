import {
  attributeInfo,
  channelTextOf,
  channelRows,
  followedValues,
} from "../chart.ts";
import {
  encodedChannels,
  type ByteRange,
  type Encode,
} from "../encode-rules.ts";
import type { Mode, ParameterDeclaration } from "../fixture-type.ts";
import { nextRange } from "../keys.ts";
import { RULES, ruleOf, type EncodeRule } from "../rules.ts";
import { followable, withRule } from "./fresh-rule.ts";
import {
  asRange,
  rangeProblem,
  refuse,
  withElement,
  without,
  type Edited,
} from "./edit.ts";

/** What `type.encoding.set` may change; each field belongs to some rules only. */
export interface EncodingChange {
  /** Another rule: the Encoding starts fresh, then the fields below apply. */
  readonly rule?: EncodeRule | undefined;
  /** The one Channel of Scale, Wheel, Range and Switch. */
  readonly channel?: string | undefined;
  /** The Channels of Color (red, green, blue and an optional white) and of Multiply. */
  readonly channels?: readonly string[] | undefined;
  /** The Channels a Wheel's brightness dims; none for an empty list. */
  readonly dims?: readonly string[] | undefined;
  /** The Parameter a Spread follows; its ranges start over. */
  readonly follows?: string | undefined;
  /** The two ranges of a Switch. */
  readonly on?: readonly [number, number] | undefined;
  readonly off?: readonly [number, number] | undefined;
  /** A Spread's range by value of the followed Parameter; null takes one away. */
  readonly ranges?:
    Readonly<Record<string, readonly [number, number] | null>> | undefined;
}

const FIELDS: Record<EncodeRule, readonly (keyof EncodingChange)[]> = {
  scale: ["channel"],
  multiply: ["channels"],
  spread: ["follows", "ranges"],
  color: ["channels"],
  wheel: ["channel", "dims"],
  range: ["channel"],
  switch: ["channel", "on", "off"],
};

const FIELD_WORDS: Record<keyof EncodingChange, string> = {
  rule: "rule",
  channel: "single Channel",
  channels: "list of Channels",
  dims: "Channels to dim",
  follows: "Parameter to follow",
  on: "on range",
  off: "off range",
  ranges: "ranges by value",
};

/** Changes a Parameter's Encoding: its rule, its Channels and the rule's own ranges. A `spread` that follows the Parameter keeps sharing its Channel. */
export function setEncoding(
  mode: Mode,
  elementKey: string,
  attribute: string,
  change: EncodingChange,
): Edited<Mode> {
  const element = mode.elements[elementKey];
  const current = element?.parameters[attribute];
  if (element === undefined || current === undefined)
    return refuse(`“${elementKey}” has no Parameter “${attribute}”.`);
  let parameter = current;
  if (change.rule !== undefined && change.rule !== ruleOf(current.encode)) {
    const { encode: _encode, ...rest } = current;
    const fresh = withRule(mode, elementKey, attribute, rest, change.rule);
    if ("error" in fresh) return fresh;
    parameter = fresh;
  }
  const rule = ruleOf(parameter.encode);
  for (const field of Object.keys(FIELD_WORDS) as (keyof EncodingChange)[])
    if (
      field !== "rule" &&
      change[field] !== undefined &&
      !FIELDS[rule].includes(field)
    )
      return refuse(`${RULES[rule].label} has no ${FIELD_WORDS[field]}.`);
  const named = [
    ...(change.channel === undefined ? [] : [change.channel]),
    ...(change.channels ?? []),
    ...(change.dims ?? []),
  ];
  for (const key of named) {
    const channel = mode.channels.find((each) => each.key === key);
    if (channel === undefined)
      return refuse(`The Mode has no Channel “${key}”.`);
    if (channel.element !== elementKey)
      return refuse(
        `Channel ${channelTextOf(mode, key)} belongs to ${mode.elements[channel.element]?.name ?? channel.element}, not to ${element.name}.`,
      );
  }
  for (const bytes of [
    change.on,
    change.off,
    ...Object.values(change.ranges ?? {}),
  ]) {
    const problem =
      bytes === undefined || bytes === null ? undefined : rangeProblem(bytes);
    if (problem !== undefined) return refuse(problem);
  }
  const encode = changedEncode(mode, elementKey, attribute, parameter, change);
  if ("error" in encode) return encode;
  const parameters = {
    ...element.parameters,
    [attribute]: { ...parameter, encode },
  };
  // A spread shares the Channel of the Parameter it follows.
  const shared = encodedChannels(encode)[0];
  for (const [key, sibling] of Object.entries(parameters))
    if (
      "spread" in sibling.encode &&
      sibling.encode.by === attribute &&
      shared !== undefined &&
      sibling.encode.spread !== shared
    )
      parameters[key] = {
        ...sibling,
        encode: { ...sibling.encode, spread: shared },
      };
  return withElement(mode, elementKey, { ...element, parameters });
}

function changedEncode(
  mode: Mode,
  elementKey: string,
  attribute: string,
  parameter: ParameterDeclaration,
  change: EncodingChange,
): Edited<Encode> {
  const encode = parameter.encode;
  if ("scale" in encode) return { scale: change.channel ?? encode.scale };
  if ("color" in encode) {
    const channels = change.channels ?? encode.color;
    if (channels.length < 3 || channels.length > 4)
      return refuse(
        "Color takes a red, a green and a blue Channel, and an optional white.",
      );
    return { color: [...channels] };
  }
  if ("wheel" in encode) {
    const wheel = change.channel ?? encode.wheel;
    const dims = (change.dims ?? encode.multiply ?? []).filter(
      (key) => key !== wheel,
    );
    return { wheel, ...(dims.length === 0 ? {} : { multiply: [...dims] }) };
  }
  if ("multiply" in encode) {
    const channels = change.channels ?? encode.multiply;
    if (channels.length === 0)
      return refuse("Multiply scales at least one Channel.");
    return { multiply: [...channels] };
  }
  if ("range" in encode) return { range: change.channel ?? encode.range };
  if ("switch" in encode)
    return {
      switch: change.channel ?? encode.switch,
      on: change.on === undefined ? encode.on : asRange(change.on),
      off: change.off === undefined ? encode.off : asRange(change.off),
    };
  const siblings = mode.elements[elementKey]?.parameters ?? {};
  let spread = encode;
  if (change.follows !== undefined && change.follows !== encode.by) {
    const followed = siblings[change.follows];
    const shared =
      followed === undefined ? undefined : encodedChannels(followed.encode)[0];
    if (
      followed === undefined ||
      shared === undefined ||
      !followable(mode, elementKey, attribute).includes(change.follows)
    )
      return refuse(
        `Spread follows a choice or a switch of the same Element, and “${change.follows}” is not one.`,
      );
    spread = { spread: shared, by: change.follows, ranges: {} };
  }
  if (change.ranges === undefined) return spread;
  const values = followedValues(spread.by, siblings[spread.by]);
  let ranges = spread.ranges;
  for (const [value, bytes] of Object.entries(change.ranges)) {
    if (bytes === null) {
      ranges = without(ranges, value);
      continue;
    }
    if (!values.some((each) => each.value === value))
      return refuse(
        `${attributeInfo(spread.by).label} has no “${value}” to hold a range for.`,
      );
    ranges = { ...ranges, [value]: asRange(bytes) };
  }
  return { ...spread, ranges };
}

/** The range a `spread` starts a value with: right after the highest range on the Channel it shares, as wide as it, or the whole Channel. */
export function nextSpreadRange(mode: Mode, channel: string): ByteRange {
  const row = channelRows(mode).find((each) => each.key === channel);
  return (
    nextRange(
      (row?.segments ?? []).map((segment) => [segment.from, segment.to]),
    ) ?? [0, 255]
  );
}
