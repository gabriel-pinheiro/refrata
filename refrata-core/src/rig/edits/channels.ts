import { attributeInfo, channelTextOf } from "../chart.ts";
import { encodedChannels } from "../encode-rules.ts";
import { ROOT_ELEMENT_KEY, type Channel, type Mode } from "../fixture-type.ts";
import { freeKey, keyFromName } from "../keys.ts";
import { refuse, renameInEncode, type Edited } from "./edit.ts";

const NAMELESS = "Give it a name with a letter or a digit.";

/** The key a Channel named `name` takes in `mode`, or undefined when the name has no letter or digit; `except` is the Channel being renamed. */
export function channelKeyFor(
  mode: Mode,
  name: string,
  except?: string,
): string | undefined {
  const base = keyFromName(name);
  if (base === "") return undefined;
  return freeKey(
    base,
    mode.channels.map((channel) => channel.key).filter((key) => key !== except),
  );
}

/** The key the next unnamed Channel takes: `channel-<n>`. */
export function nextChannelKey(mode: Mode): string {
  return freeKey(
    `channel-${String(mode.channels.length + 1)}`,
    mode.channels.map((channel) => channel.key),
  );
}

/** Adds a Channel at the end of the Layout, on `element` (the root unless told). */
export function addChannel(
  mode: Mode,
  options: {
    readonly element?: string | undefined;
    readonly name?: string | undefined;
    readonly bytes?: Channel["bytes"] | undefined;
  } = {},
): Edited<Mode> {
  const element = options.element ?? ROOT_ELEMENT_KEY;
  if (!(element in mode.elements))
    return refuse(`The Mode has no Element “${element}”.`);
  const key =
    options.name === undefined
      ? nextChannelKey(mode)
      : channelKeyFor(mode, options.name);
  if (key === undefined) return refuse(NAMELESS);
  return {
    ...mode,
    channels: [
      ...mode.channels,
      { key, element, bytes: options.bytes ?? 1, default: 0 },
    ],
  };
}

/** Every mention of a Channel key in the Mode's Encodings and Actions swapped for another. */
function renameChannelRefs(mode: Mode, from: string, to: string): Mode {
  const elements = Object.fromEntries(
    Object.entries(mode.elements).map(([key, element]) => [
      key,
      {
        ...element,
        parameters: Object.fromEntries(
          Object.entries(element.parameters).map(([attribute, parameter]) => [
            attribute,
            encodedChannels(parameter.encode).includes(from)
              ? {
                  ...parameter,
                  encode: renameInEncode(parameter.encode, from, to),
                }
              : parameter,
          ]),
        ),
      },
    ]),
  );
  const actions = Object.fromEntries(
    Object.entries(mode.actions).map(([key, action]) => [
      key,
      action.channel === from ? { ...action, channel: to } : action,
    ]),
  );
  return { ...mode, elements, actions };
}

/**
 * Changes a Channel. A new name gives it a new key, and everything in the
 * Mode that names the Channel follows. It cannot move to another Element
 * while a Parameter of its Element writes it.
 */
export function updateChannel(
  mode: Mode,
  key: string,
  change: {
    readonly name?: string | undefined;
    readonly bytes?: Channel["bytes"] | undefined;
    readonly element?: string | undefined;
    readonly rest?: number | undefined;
  },
): Edited<Mode> {
  const channel = mode.channels.find((each) => each.key === key);
  if (channel === undefined) return refuse(`The Mode has no Channel “${key}”.`);
  let next = mode;
  let nextKey = key;
  if (change.name !== undefined) {
    const renamed = channelKeyFor(mode, change.name, key);
    if (renamed === undefined) return refuse(NAMELESS);
    nextKey = renamed;
  }
  if (change.element !== undefined && change.element !== channel.element) {
    const target = mode.elements[change.element];
    if (target === undefined)
      return refuse(`The Mode has no Element “${change.element}”.`);
    const owner = mode.elements[channel.element];
    const writer = Object.entries(owner?.parameters ?? {}).find(
      ([, parameter]) => encodedChannels(parameter.encode).includes(key),
    );
    if (writer !== undefined)
      return refuse(
        `${attributeInfo(writer[0]).label} of ${owner?.name ?? channel.element} writes Channel ${channelTextOf(mode, key)}. Point it at another Channel or remove it first.`,
      );
  }
  const changed: Channel = {
    key: nextKey,
    element: change.element ?? channel.element,
    bytes: change.bytes ?? channel.bytes,
    default: change.rest ?? channel.default,
  };
  next = {
    ...next,
    channels: next.channels.map((each) => (each.key === key ? changed : each)),
  };
  return nextKey === key ? next : renameChannelRefs(next, key, nextKey);
}

/** Moves a Channel to right after another on the wire, or to the front with `after` null. */
export function moveChannel(
  mode: Mode,
  key: string,
  after: string | null,
): Edited<Mode> {
  const moving = mode.channels.find((channel) => channel.key === key);
  if (moving === undefined) return refuse(`The Mode has no Channel “${key}”.`);
  if (after === key) return refuse("A Channel cannot be placed after itself.");
  const others = mode.channels.filter((channel) => channel.key !== key);
  const at =
    after === null
      ? 0
      : others.findIndex((channel) => channel.key === after) + 1;
  if (at === 0 && after !== null)
    return refuse(`The Mode has no Channel “${after}”.`);
  return {
    ...mode,
    channels: [...others.slice(0, at), moving, ...others.slice(at)],
  };
}

/** Removes a Channel nothing names; a Parameter or an Action that names it is said. */
export function removeChannel(mode: Mode, key: string): Edited<Mode> {
  if (!mode.channels.some((channel) => channel.key === key))
    return refuse(`The Mode has no Channel “${key}”.`);
  const label = channelTextOf(mode, key);
  for (const element of Object.values(mode.elements))
    for (const [attribute, parameter] of Object.entries(element.parameters))
      if (encodedChannels(parameter.encode).includes(key))
        return refuse(
          `${attributeInfo(attribute).label} of ${element.name} writes Channel ${label}. Point it at another Channel or remove it first.`,
        );
  const action = Object.values(mode.actions).find(
    (each) => each.channel === key,
  );
  if (action !== undefined)
    return refuse(
      `Action “${action.name}” holds Channel ${label}. Change or remove it first.`,
    );
  if (mode.channels.length === 1)
    return refuse("A Mode needs at least one Channel.");
  return {
    ...mode,
    channels: mode.channels.filter((channel) => channel.key !== key),
  };
}
