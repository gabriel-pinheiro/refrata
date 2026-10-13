import { ROOT_ELEMENT_KEY, type Mode } from "../fixture-type.ts";
import { freeKey, keyFromName } from "../keys.ts";
import {
  parentOf,
  refuse,
  subtreeKeys,
  withElement,
  without,
  type Edited,
} from "./edit.ts";

const TAG = /^[a-z0-9][a-z0-9-]*$/;

/** The key an Element named `name` takes in `mode`, or undefined when the name has no letter or digit. */
export function elementKeyFor(mode: Mode, name: string): string | undefined {
  const base = keyFromName(name);
  return base === "" ? undefined : freeKey(base, Object.keys(mode.elements));
}

/** Adds an Element last under `parent` (the root unless told). Its key comes from its name and never changes. */
export function addElement(
  mode: Mode,
  options: { readonly parent?: string | undefined; readonly name: string },
): Edited<Mode> {
  const parentKey = options.parent ?? ROOT_ELEMENT_KEY;
  const parent = mode.elements[parentKey];
  if (parent === undefined)
    return refuse(`The Mode has no Element “${parentKey}”.`);
  const key = elementKeyFor(mode, options.name);
  if (key === undefined)
    return refuse("Give the Element a name with a letter or a digit.");
  return {
    ...mode,
    elements: {
      ...mode.elements,
      [parentKey]: { ...parent, children: [...parent.children, key] },
      [key]: {
        name: options.name.trim(),
        children: [],
        tags: [],
        parameters: {},
      },
    },
  };
}

/** Renames an Element (its key stays) or replaces its Tags. */
export function updateElement(
  mode: Mode,
  key: string,
  change: {
    readonly name?: string | undefined;
    readonly tags?: readonly string[] | undefined;
  },
): Edited<Mode> {
  const element = mode.elements[key];
  if (element === undefined) return refuse(`The Mode has no Element “${key}”.`);
  if (change.name?.trim() === "") return refuse("An Element needs a name.");
  const bad = change.tags?.find((tag) => !TAG.test(tag));
  if (bad !== undefined)
    return refuse(
      `“${bad}” is not a Tag: use lowercase letters, digits and dashes.`,
    );
  return withElement(mode, key, {
    ...element,
    name: change.name?.trim() ?? element.name,
    tags: change.tags === undefined ? element.tags : [...new Set(change.tags)],
  });
}

/**
 * Moves an Element among its siblings or under another parent, landing
 * after the sibling `after` names, first with null, last when it is left
 * out. Never under itself or its own descendants; the root stays put.
 */
export function moveElement(
  mode: Mode,
  key: string,
  to: {
    readonly parent?: string | undefined;
    readonly after?: string | null | undefined;
  },
): Edited<Mode> {
  if (!(key in mode.elements))
    return refuse(`The Mode has no Element “${key}”.`);
  const from = parentOf(mode, key);
  if (from === undefined) return refuse("The root Element stays at the top.");
  const parentKey = to.parent ?? from;
  const parent = mode.elements[parentKey];
  if (parent === undefined)
    return refuse(`The Mode has no Element “${parentKey}”.`);
  if (subtreeKeys(mode, key).includes(parentKey))
    return refuse("An Element cannot go under itself or its own descendants.");
  if (to.after === key)
    return refuse("An Element cannot be placed after itself.");
  const siblings = parent.children.filter((child) => child !== key);
  const at =
    to.after === undefined
      ? siblings.length
      : to.after === null
        ? 0
        : siblings.indexOf(to.after) + 1;
  if (at === 0 && to.after !== null && to.after !== undefined)
    return refuse(`“${to.after}” is not under ${parent.name}.`);
  const old = mode.elements[from];
  const elements = { ...mode.elements };
  if (old !== undefined && from !== parentKey)
    elements[from] = {
      ...old,
      children: old.children.filter((child) => child !== key),
    };
  elements[parentKey] = {
    ...parent,
    children: [...siblings.slice(0, at), key, ...siblings.slice(at)],
  };
  return { ...mode, elements };
}

/** Removes an Element with everything under it: their Channels go to its parent, their Parameters go with them. */
export function removeElement(mode: Mode, key: string): Edited<Mode> {
  if (!(key in mode.elements))
    return refuse(`The Mode has no Element “${key}”.`);
  const parentKey = parentOf(mode, key);
  const parent = parentKey === undefined ? undefined : mode.elements[parentKey];
  if (parentKey === undefined || parent === undefined)
    return refuse("The root Element cannot be removed.");
  const gone = subtreeKeys(mode, key);
  let elements: Mode["elements"] = mode.elements;
  for (const each of gone) elements = without(elements, each);
  elements = {
    ...elements,
    [parentKey]: {
      ...parent,
      children: parent.children.filter((child) => child !== key),
    },
  };
  return {
    ...mode,
    elements,
    channels: mode.channels.map((channel) =>
      gone.includes(channel.element)
        ? { ...channel, element: parentKey }
        : channel,
    ),
  };
}
