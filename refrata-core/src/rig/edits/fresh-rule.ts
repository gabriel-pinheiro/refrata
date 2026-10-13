import { ATTRIBUTES, isAttributeKey } from "../attributes.ts";
import { attributeInfo } from "../chart.ts";
import { encodedChannels } from "../encode-rules.ts";
import type { Mode, ParameterDeclaration } from "../fixture-type.ts";
import { RULES, type EncodeRule } from "../rules.ts";
import { ownChannels, refuse, type Edited } from "./edit.ts";

/** The Parameters of an Element a `spread` can follow: its choices and booleans, but for `except`. */
export function followable(
  mode: Mode,
  element: string,
  except: string,
): string[] {
  return Object.keys(mode.elements[element]?.parameters ?? {}).filter((key) => {
    const kind = attributeInfo(key).kind;
    return key !== except && (kind === "choice" || kind === "boolean");
  });
}

/** Why `rule` cannot be a Parameter's Encoding on this Element, or undefined when it can. */
export function ruleProblem(
  mode: Mode,
  elementKey: string,
  attribute: string,
  rule: EncodeRule,
): string | undefined {
  const element = mode.elements[elementKey];
  if (element === undefined) return `The Mode has no Element “${elementKey}”.`;
  const { label, kind } = attributeInfo(attribute);
  if (RULES[rule].reads !== kind)
    return `${RULES[rule].label} reads a ${RULES[rule].reads}, and ${label} is a ${kind}.`;
  const channels = ownChannels(mode, elementKey);
  if (channels.length === 0)
    return `${element.name} has no Channel. Give it one first.`;
  if (rule === "color" && channels.length < 3)
    return `Color needs three Channels, and ${element.name} has ${String(channels.length)}.`;
  if (rule === "spread" && followable(mode, elementKey, attribute).length === 0)
    return `Spread follows a choice or a switch of the same Element, and ${element.name} has none.`;
  return undefined;
}

/** A Parameter with a fresh Encoding of `rule`, pointed at its Element's first Channels, with what the rule needs filled in and what it cannot have dropped. */
export function withRule(
  mode: Mode,
  elementKey: string,
  attribute: string,
  parameter: Omit<ParameterDeclaration, "encode">,
  rule: EncodeRule,
): Edited<ParameterDeclaration> {
  const problem = ruleProblem(mode, elementKey, attribute, rule);
  if (problem !== undefined) return refuse(problem);
  const channels = ownChannels(mode, elementKey);
  const first = channels[0] ?? "";
  const { swatches: _swatches, settle: _settle, ...plain } = parameter;
  switch (rule) {
    case "scale":
      return { ...plain, encode: { scale: first } };
    case "multiply": {
      const mix = Object.values(mode.elements[elementKey]?.parameters ?? {})
        .map((sibling) => sibling.encode)
        .find((encode) => "color" in encode);
      return {
        ...plain,
        encode: {
          multiply:
            mix !== undefined && "color" in mix
              ? mix.color.slice(0, 3)
              : channels.slice(0, 3),
        },
      };
    }
    case "color":
      return {
        ...plain,
        encode: { color: [first, channels[1] ?? "", channels[2] ?? ""] },
      };
    case "wheel":
      return {
        ...parameter,
        swatches: parameter.swatches ?? [
          { label: "White", color: [1, 1, 1], bytes: [0, 9] },
        ],
        encode: { wheel: first },
      };
    case "range": {
      const definition = isAttributeKey(attribute)
        ? ATTRIBUTES[attribute]
        : undefined;
      const start =
        definition?.kind === "choice" ? definition.options[0] : undefined;
      return {
        ...plain,
        options: parameter.options ?? [
          {
            value: start?.value ?? "open",
            label: start?.label ?? "Open",
            bytes: [0, 9],
          },
        ],
        encode: { range: first },
      };
    }
    case "switch":
      return {
        ...plain,
        encode: { switch: first, off: [0, 127], on: [128, 255] },
      };
    case "spread": {
      const by = followable(mode, elementKey, attribute)[0] ?? "";
      const followed = mode.elements[elementKey]?.parameters[by];
      return {
        ...plain,
        encode: {
          spread:
            followed === undefined
              ? first
              : (encodedChannels(followed.encode)[0] ?? first),
          by,
          ranges: {},
        },
      };
    }
  }
}
