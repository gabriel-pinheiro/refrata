import {
  FIXTURE_TYPE_FILE_KIND,
  FIXTURE_TYPE_FORMAT_VERSION,
  ROOT_ELEMENT_KEY,
  type FixtureType,
  type Mode,
  type Shape,
} from "../fixture-type.ts";
import { freeKey, keyFromName } from "../keys.ts";
import { refuse, without, type Edited } from "./edit.ts";

/** A Mode of `channels` one-byte Channels, all on a root Element named after the type. */
export function blankMode(
  name: string,
  rootName: string,
  channels: number,
): Mode {
  return {
    name,
    channels: Array.from({ length: channels }, (_, index) => ({
      key: `channel-${String(index + 1)}`,
      element: ROOT_ELEMENT_KEY,
      bytes: 1 as const,
      default: 0,
    })),
    shape: { template: "single" },
    elements: {
      [ROOT_ELEMENT_KEY]: {
        name: rootName,
        children: [],
        tags: [],
        parameters: {},
      },
    },
    actions: {},
  };
}

/** The key a type by this manufacturer and model takes, free among `taken`; undefined when either has no letter or digit. */
export function typeKeyFor(
  taken: Iterable<string>,
  manufacturer: string,
  model: string,
): string | undefined {
  const maker = keyFromName(manufacturer);
  const name = keyFromName(model);
  if (maker === "" || name === "") return undefined;
  return freeKey(`${maker}/${name}`, taken);
}

/** A new Fixture Type: one Mode named for its Channel count, that many one-byte Channels on the root Element. */
export function blankType(
  key: string,
  manufacturer: string,
  model: string,
  channels: number,
): FixtureType {
  const mode = `${String(channels)}ch`;
  return {
    kind: FIXTURE_TYPE_FILE_KIND,
    formatVersion: FIXTURE_TYPE_FORMAT_VERSION,
    key,
    manufacturer: manufacturer.trim(),
    model: model.trim(),
    modes: { [mode]: blankMode(mode, model.trim(), channels) },
  };
}

/** The key a Mode named `name` takes in `type`, or undefined when the name has no letter or digit. */
export function modeKeyFor(
  type: FixtureType,
  name: string,
): string | undefined {
  const base = keyFromName(name);
  return base === "" ? undefined : freeKey(base, Object.keys(type.modes));
}

/** Adds a Mode: a copy of the Mode `from` names, or one Channel on a root Element. Its key comes from its name and never changes. */
export function addMode(
  type: FixtureType,
  options: { readonly name: string; readonly from?: string | undefined },
): Edited<FixtureType> {
  const key = modeKeyFor(type, options.name);
  if (key === undefined)
    return refuse("Give the Mode a name with a letter or a digit.");
  const source =
    options.from === undefined ? undefined : type.modes[options.from];
  if (options.from !== undefined && source === undefined)
    return refuse(`${type.model} has no Mode “${options.from}”.`);
  const name = options.name.trim();
  const mode: Mode =
    source === undefined ? blankMode(name, type.model, 1) : { ...source, name };
  return { ...type, modes: { ...type.modes, [key]: mode } };
}

/** Renames a Mode (its key stays), or changes its notes or its Shape Template; empty notes are removed. */
export function updateMode(
  type: FixtureType,
  key: string,
  change: {
    readonly name?: string | undefined;
    readonly notes?: string | undefined;
    readonly shape?: Shape | undefined;
  },
): Edited<FixtureType> {
  const current = type.modes[key];
  if (current === undefined)
    return refuse(`${type.model} has no Mode “${key}”.`);
  if (change.name?.trim() === "") return refuse("A Mode needs a name.");
  const { notes: oldNotes, ...rest } = current;
  const notes = change.notes === undefined ? oldNotes : change.notes.trim();
  const mode: Mode = {
    ...rest,
    name: change.name?.trim() ?? current.name,
    shape: change.shape ?? current.shape,
    ...(notes === undefined || notes === "" ? {} : { notes }),
  };
  return { ...type, modes: { ...type.modes, [key]: mode } };
}

/** Removes a Mode, but the last one a type has. */
export function removeMode(
  type: FixtureType,
  key: string,
): Edited<FixtureType> {
  if (!(key in type.modes))
    return refuse(`${type.model} has no Mode “${key}”.`);
  if (Object.keys(type.modes).length === 1)
    return refuse("A Fixture Type needs at least one Mode.");
  return { ...type, modes: without(type.modes, key) };
}
