import type { Action, Mode } from "../fixture-type.ts";
import { freeKey, keyFromName } from "../keys.ts";
import { refuse, without, type Edited } from "./edit.ts";

/** The key an Action named `name` takes in `mode`, or undefined when the name has no letter or digit. */
export function actionKeyFor(mode: Mode, name: string): string | undefined {
  const base = keyFromName(name);
  return base === "" ? undefined : freeKey(base, Object.keys(mode.actions));
}

function actionProblem(mode: Mode, action: Action): string | undefined {
  if (action.name.trim() === "") return "An Action needs a name.";
  if (!mode.channels.some((channel) => channel.key === action.channel))
    return `The Mode has no Channel “${action.channel}”.`;
  return undefined;
}

/** Adds an Action: byte 255 held on the last Channel for five seconds unless told. Its key comes from its name and never changes. */
export function addAction(
  mode: Mode,
  options: {
    readonly name: string;
    readonly channel?: string | undefined;
    readonly byte?: number | undefined;
    readonly seconds?: number | undefined;
  },
): Edited<Mode> {
  const key = actionKeyFor(mode, options.name);
  if (key === undefined)
    return refuse("Give the Action a name with a letter or a digit.");
  const action: Action = {
    name: options.name.trim(),
    channel: options.channel ?? mode.channels.at(-1)?.key ?? "",
    byte: options.byte ?? 255,
    seconds: options.seconds ?? 5,
  };
  const problem = actionProblem(mode, action);
  if (problem !== undefined) return refuse(problem);
  return { ...mode, actions: { ...mode.actions, [key]: action } };
}

/** Changes an Action's name (its key stays), Channel, byte or seconds. */
export function updateAction(
  mode: Mode,
  key: string,
  change: Partial<Action>,
): Edited<Mode> {
  const current = mode.actions[key];
  if (current === undefined) return refuse(`The Mode has no Action “${key}”.`);
  const action: Action = {
    name: change.name?.trim() ?? current.name,
    channel: change.channel ?? current.channel,
    byte: change.byte ?? current.byte,
    seconds: change.seconds ?? current.seconds,
  };
  const problem = actionProblem(mode, action);
  if (problem !== undefined) return refuse(problem);
  return { ...mode, actions: { ...mode.actions, [key]: action } };
}

export function removeAction(mode: Mode, key: string): Edited<Mode> {
  if (!(key in mode.actions)) return refuse(`The Mode has no Action “${key}”.`);
  return { ...mode, actions: without(mode.actions, key) };
}
