import {
  ATTRIBUTES,
  isAttributeKey,
  type AttributeDefinition,
} from "./attributes.ts";
import { encodedChannels, type Encode } from "./encode-rules.ts";
import type { Mode, ParameterDeclaration } from "./fixture-type.ts";

const ROOT = "root";

/**
 * Every reference a Mode makes must land: Channels on Elements, Encoding
 * on Channels of the same Element, a rule on a Parameter of the kind it
 * reads, `spread` on a sibling Parameter whose options its ranges name,
 * Actions on Channels, the tree on `root`.
 */
export function modeProblems(mode: Mode): string[] {
  const problems: string[] = [];
  const channelKeys = new Set<string>();
  for (const channel of mode.channels) {
    if (channelKeys.has(channel.key))
      problems.push(`Channel “${channel.key}” is declared twice`);
    channelKeys.add(channel.key);
    if (!(channel.element in mode.elements))
      problems.push(
        `Channel “${channel.key}” names unknown Element “${channel.element}”`,
      );
  }
  if (!(ROOT in mode.elements)) problems.push(`Element “${ROOT}” is missing`);
  const parents = new Map<string, string>();
  for (const [key, element] of Object.entries(mode.elements)) {
    for (const child of element.children) {
      if (!(child in mode.elements))
        problems.push(`Element “${key}” lists unknown child “${child}”`);
      else if (child === ROOT)
        problems.push(`Element “${ROOT}” cannot be a child`);
      else if (parents.has(child))
        problems.push(`Element “${child}” has two parents`);
      else parents.set(child, key);
    }
    for (const [attribute, parameter] of Object.entries(element.parameters)) {
      const where = `“${attribute}” of “${key}”`;
      if (!isAttributeKey(attribute)) {
        problems.push(
          `Element “${key}” declares unknown Attribute “${attribute}”`,
        );
        continue;
      }
      problems.push(
        ...ruleProblems(where, attribute, parameter, element.parameters),
      );
      for (const channelKey of encodedChannels(parameter.encode)) {
        const channel = mode.channels.find(
          (candidate) => candidate.key === channelKey,
        );
        if (channel === undefined)
          problems.push(
            `${where} encodes into unknown Channel “${channelKey}”`,
          );
        else if (channel.element !== key)
          problems.push(
            `${where} encodes into Channel “${channelKey}” of another Element`,
          );
      }
    }
  }
  for (const key of Object.keys(mode.elements)) {
    if (key !== ROOT && !parents.has(key))
      problems.push(`Element “${key}” is not reachable from “${ROOT}”`);
  }
  for (const [key, action] of Object.entries(mode.actions)) {
    if (!channelKeys.has(action.channel))
      problems.push(
        `Action “${key}” names unknown Channel “${action.channel}”`,
      );
  }
  return problems;
}

/** Why a Parameter's rule, options and swatches do not fit its Attribute. */
function ruleProblems(
  where: string,
  attribute: keyof typeof ATTRIBUTES,
  parameter: ParameterDeclaration,
  siblings: Readonly<Record<string, ParameterDeclaration>>,
): string[] {
  const problems: string[] = [];
  const definition: AttributeDefinition = ATTRIBUTES[attribute];
  const kind = definition.kind;
  const reads = readKind(parameter.encode);
  if (reads !== kind)
    problems.push(`${where} is a ${kind} and cannot encode as a ${reads}`);
  const open = definition.kind === "choice" && definition.open === true;
  if (parameter.options !== undefined && !open)
    problems.push(`${where} is not an open choice and cannot declare options`);
  if ("range" in parameter.encode && parameter.options === undefined)
    problems.push(`${where} encodes as a range but declares no options`);
  if ("wheel" in parameter.encode && parameter.swatches === undefined)
    problems.push(`${where} encodes as a wheel but declares no swatches`);
  if (parameter.swatches !== undefined && kind !== "color")
    problems.push(`${where} is not a color and cannot declare swatches`);
  if ("spread" in parameter.encode) {
    const by = siblings[parameter.encode.by];
    const byKind = isAttributeKey(parameter.encode.by)
      ? ATTRIBUTES[parameter.encode.by].kind
      : undefined;
    if (by === undefined || byKind === undefined)
      problems.push(
        `${where} spreads by “${parameter.encode.by}”, which the Element does not declare`,
      );
    else if (byKind !== "choice" && byKind !== "boolean")
      problems.push(
        `${where} spreads by “${parameter.encode.by}”, which is not a choice or a boolean`,
      );
    else if (!encodedChannels(by.encode).includes(parameter.encode.spread))
      problems.push(
        `${where} spreads on a Channel “${parameter.encode.by}” does not write`,
      );
    else {
      const values =
        byKind === "boolean"
          ? ["on", "off"]
          : (by.options?.map((option) => option.value) ??
            (isAttributeKey(parameter.encode.by)
              ? optionValues(parameter.encode.by)
              : []));
      for (const value of Object.keys(parameter.encode.ranges))
        if (!values.includes(value))
          problems.push(
            `${where} spreads over “${value}”, which “${parameter.encode.by}” does not offer`,
          );
    }
  }
  return problems;
}

function optionValues(attribute: keyof typeof ATTRIBUTES): readonly string[] {
  const definition = ATTRIBUTES[attribute];
  return definition.kind === "choice"
    ? definition.options.map((option) => option.value)
    : [];
}

/** The Parameter kind a rule reads. */
function readKind(encode: Encode): "number" | "color" | "choice" | "boolean" {
  if ("color" in encode || "wheel" in encode) return "color";
  if ("range" in encode) return "choice";
  if ("switch" in encode) return "boolean";
  return "number";
}
