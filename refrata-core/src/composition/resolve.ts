import { effectiveAt } from "../address/links.ts";
import type { Document } from "../document/document.ts";
import { allFixtures, fixtureElements } from "../document/fixtures.ts";
import { childLayers } from "../document/layers.ts";
import type { TargetedLayer } from "../document/composition.ts";
import type {
  Color,
  ParameterDefinition,
  ParameterValue,
  ParameterValues,
} from "../parameters.ts";
import type { AttributeKey } from "../rig/attributes.ts";
import { elementRef, type Element } from "../rig/elements.ts";
import { defaultsOf } from "../rig/encoding.ts";
import { snapToGamut } from "../rig/gamut.ts";
import { blendValue } from "./blend.ts";
import { lookContributions } from "./contributions.ts";
import {
  visualContributions,
  type VisualOutputs,
} from "./visual-contributions.ts";

/** Every Element's resolved values, keyed by `<fixtureId>/<key>`. */
export type ResolvedDocument = ReadonlyMap<string, ParameterValues>;

/**
 * Resolve: every Element's Parameter Values for this frame. Start from the
 * Mode's Defaults, apply the active Scene's Layers bottom to top with their
 * opacity and Blend Mode (a Look Layer from its rows, a Visual Layer from
 * what its Visual wrote this frame, handed in as `visuals` by whoever steps
 * the instances), then Master scales every `dimmer`, a held Highlight
 * overrides, and a colour on a wheel snaps to its swatch, so Studio and
 * Encoding both see what the fixture will show. Blackout is not here: it
 * kills the encoded frame (rig/frames.ts) and leaves the composition as it
 * is, so Studio still shows the look. Links are read here, so a Controller
 * on a Layer's opacity or row is seen at the output rate. Nothing below the
 * Element level is touched: bytes are Encoding's business.
 */
export function resolveDocument(
  document: Document,
  visuals?: VisualOutputs,
): ResolvedDocument {
  const values = new Map<string, Record<string, ParameterValue>>();
  const elements = new Map<string, Element>();
  const highlighted = new Map<string, boolean>();
  for (const fixture of allFixtures(document.fixtures)) {
    const tree = fixtureElements(document, fixture);
    for (const element of tree) {
      const ref = elementRef(fixture.id, element.key);
      values.set(ref, { ...defaultsOf(element) });
      elements.set(ref, element);
      highlighted.set(ref, isHighlighted(document, fixture.id, tree, element));
    }
  }

  for (const layer of activeStack(document)) {
    const opacity = effectiveAt(
      document,
      `layer/${layer.id}/opacity`,
      layer.opacity,
    );
    if (typeof opacity !== "number" || opacity <= 0) continue;
    const contributions =
      layer.kind === "look"
        ? lookContributions(document, layer)
        : visualContributions(document, layer, visuals?.get(layer.id));
    for (const [ref, byAttribute] of contributions) {
      const own = values.get(ref);
      const element = elements.get(ref);
      if (own === undefined || element === undefined) continue;
      for (const [attribute, contribution] of byAttribute) {
        const parameter = element.parameters[attribute];
        const current = own[attribute];
        if (parameter === undefined || current === undefined) continue;
        own[attribute] = blendValue(
          parameter.definition.kind,
          current,
          contribution.value,
          contribution.alpha * opacity,
          layer.blendMode,
        );
      }
    }
  }

  const master = effectiveAt(
    document,
    "installation/master",
    document.installation.master,
  );
  const scale = typeof master === "number" ? master : 1;
  for (const [ref, own] of values) {
    const element = elements.get(ref);
    if (element === undefined) continue;
    for (const [key, parameter] of Object.entries(element.parameters)) {
      const attribute = key as AttributeKey;
      let value = clamp(parameter.definition, own[attribute]);
      if (attribute === "dimmer" && typeof value === "number")
        value = value * scale;
      if (highlighted.get(ref) === true && parameter.highlight !== undefined)
        value = parameter.highlight;
      if (parameter.swatches !== undefined && Array.isArray(value))
        value = snapToGamut(value as Color, parameter.swatches);
      own[attribute] = value;
    }
  }
  return values;
}

/** The active Scene's Look and Visual Layers bottom to top, skipping anything disabled by itself or a Group above it. */
function activeStack(document: Document): readonly TargetedLayer[] {
  const sceneId = document.installation.activeScene;
  if (sceneId === null || !(sceneId in document.scenes)) return [];
  const result: TargetedLayer[] = [];
  const visit = (parentId: string | null): void => {
    for (const layer of childLayers(document.layers, sceneId, parentId)) {
      const enabled = effectiveAt(
        document,
        `layer/${layer.id}/enabled`,
        layer.enabled,
      );
      if (enabled !== true) continue;
      if (layer.kind === "group") visit(layer.id);
      else result.push(layer);
    }
  };
  visit(null);
  return result.reverse();
}

function isHighlighted(
  document: Document,
  fixtureId: string,
  tree: readonly Element[],
  element: Element,
): boolean {
  const held = document.operational.highlight;
  let current: Element | undefined = element;
  while (current !== undefined) {
    if (held[elementRef(fixtureId, current.key)] === true) return true;
    const parentKey: string | null = current.parentKey;
    current =
      parentKey === null
        ? undefined
        : tree.find((candidate) => candidate.key === parentKey);
  }
  return false;
}

/** Numbers stay in the Parameter's range and colours in 0..1 after blending, whatever `add` did. */
function clamp(
  definition: ParameterDefinition,
  value: ParameterValue | undefined,
): ParameterValue {
  if (value === undefined) return definition.default;
  if (definition.kind === "number" && typeof value === "number")
    return Math.min(definition.max, Math.max(definition.min, value));
  if (definition.kind === "color" && Array.isArray(value)) {
    const [r, g, b, a] = value as Color;
    return [unit(r), unit(g), unit(b), unit(a)];
  }
  return value;
}

const unit = (channel: number): number => Math.min(1, Math.max(0, channel));
