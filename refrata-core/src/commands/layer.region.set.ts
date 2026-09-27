import { z } from "zod";

import { linkAt, linkSourceName, linksUnder } from "../address/links.ts";
import {
  accepted,
  defineCommand,
  rejected,
  type CommandOutcome,
} from "../command/command.ts";
import { axisBounds, regionLimits } from "../composition/region-reach.ts";
import { clampWithin } from "../composition/row-reach.ts";
import type { Patch } from "../document/patch.ts";
import {
  REGION_AIM_LABELS,
  REGION_AXES,
  REGION_FORM_LABELS,
  REGION_FORMS,
  regionAim,
  regionAimLabel,
  regionAimNames,
  regionForBlend,
  regionPlace,
  regionPlacePrefix,
  toRegionForm,
  type Region,
  type RegionAimName,
} from "../document/region.ts";
import { isRegionSlot } from "../document/visual-layers.ts";
import { ATTRIBUTES } from "../rig/attributes.ts";
import { settings } from "../settings.ts";
import { visualDefinition } from "../visuals/catalog.ts";
import { notLayerOf } from "./kind-problems.ts";

const AimValues = z
  .object({ pan: z.number().optional(), tilt: z.number().optional() })
  .strict();

const degrees = (value: number): string =>
  `${value.toFixed(settings.aim.decimals)}°`;

/**
 * Sets the Region of a Visual Layer whose Visual draws inside one: the
 * fields given replace the Region's, in degrees, and `form` writes it the
 * other way, keeping the box. A typed Aim is held to the widest range the
 * Elements the Layer reaches cover together, with a warning naming the
 * value asked, as an Aim of a Look Layer is; an axis a Preset drives
 * refuses. Corners are places, so a Layer on the Blend Mode `add` takes
 * center and size only. Changing the form takes the Links of the Aims the
 * new form lacks. On a Layer that had no Region its Visual's two Slots
 * leave their bindings for it. A run of edits undoes as one step.
 */
export const layerRegionSet = defineCommand({
  name: "layer.region.set",
  kind: "authoring",
  description:
    "Set the Region of a Visual Layer running a movement Visual, in degrees: form is corners (from and to, each {pan, tilt}) or center (center {pan, tilt}, width, height); fields left out keep their value, and a new form keeps the box. On Blend Mode add only center, which is then an offset.",
  payload: z
    .object({
      layerId: z.string().min(1),
      form: z.enum(REGION_FORMS).optional(),
      from: AimValues.optional(),
      to: AimValues.optional(),
      center: AimValues.optional(),
      width: z.number().optional(),
      height: z.number().optional(),
    })
    .strict(),
  label: ({ form }) => (form === undefined ? "Set Region" : "Change Region"),
  coalesceKey: ({ layerId, form }) =>
    form === undefined ? `layer.region.set:${layerId}` : undefined,
  apply({ document, payload }): CommandOutcome {
    const layer = document.layers[payload.layerId];
    if (layer?.kind !== "visual")
      return rejected(notLayerOf(document, payload.layerId, "visual"));
    const definition = visualDefinition(layer.visual);
    const declared = definition?.region;
    if (declared === undefined)
      return rejected(
        `${layer.name} runs ${definition?.name ?? `“${layer.visual}”`}, which does not draw inside a Region.`,
      );
    const current =
      layer.region ?? regionForBlend(declared.default, layer.blendMode);
    const form = payload.form ?? current.form;
    if (form === "corners" && layer.blendMode === "add")
      return rejected(
        `“${layer.name}” is on Add, where a Region is an offset and a size. Corners are places: use center and size, or another Blend Mode.`,
      );
    const written = toRegionForm(current, form);
    const region: Region =
      written.form === "corners"
        ? { form: "corners", from: { ...written.from }, to: { ...written.to } }
        : { ...written, center: { ...written.center } };
    const warnings: string[] = [];
    for (const name of ["from", "to", "center"] as const) {
      const asked = payload[name];
      if (asked === undefined) continue;
      const aim = regionAim(region, name);
      if (aim === undefined)
        return rejected(
          `The Region of “${layer.name}” is by ${REGION_FORM_LABELS[form].toLowerCase()}; it has no ${REGION_AIM_LABELS[name]}. Give the form to change it.`,
        );
      for (const axis of REGION_AXES) {
        const value = asked[axis];
        if (value === undefined) continue;
        const label = `${regionAimLabel(name, layer.blendMode)} ${ATTRIBUTES[axis].label}`;
        if (!Number.isFinite(value))
          return rejected(`${label} must be a finite number.`);
        const link = linkAt(document, regionPlace(layer.id, name, axis));
        if (link !== undefined)
          return rejected(
            `${label} is controlled by ${linkSourceName(document, link)}.`,
          );
        const held = clampWithin(
          value,
          regionAim(current, name)?.[axis],
          regionLimits(document, layer, axis),
        );
        if (held !== value)
          warnings.push(
            `${label} clamped to ${degrees(held)} from ${degrees(value)}: the Elements it reaches go no further.`,
          );
        aim[axis] = held;
      }
    }
    for (const [field, axis] of [
      ["width", "pan"],
      ["height", "tilt"],
    ] as const) {
      const value = payload[field];
      if (value === undefined) continue;
      if (region.form !== "center")
        return rejected(
          `The Region of “${layer.name}” is by corners; its size is between them. Give the form to change it.`,
        );
      const { min, max } = axisBounds(axis);
      if (!Number.isFinite(value) || value < 0 || value > max - min)
        return rejected(
          `The ${field} of a Region must be between 0 and ${String(max - min)} degrees.`,
        );
      region[field] = value;
    }
    const patches: Patch[] = [];
    const kept = new Set<RegionAimName>(regionAimNames(form));
    let links = 0;
    for (const link of linksUnder(document.links, regionPlacePrefix(layer.id)))
      if (!namesAimAmong(link.address, kept)) {
        patches.push({ op: "remove", path: ["links", link.id] });
        links += 1;
      }
    if (links > 0)
      warnings.push(
        `Removed ${String(links)} Link${links === 1 ? "" : "s"} of the Aims it no longer has`,
      );
    if (layer.region === undefined)
      for (const slot of Object.keys(layer.bindings))
        if (isRegionSlot(definition, slot))
          patches.push({
            op: "remove",
            path: ["layers", layer.id, "bindings", slot],
          });
    if (
      layer.region === undefined ||
      JSON.stringify(layer.region) !== JSON.stringify(region)
    )
      patches.push({
        op: "set",
        path: ["layers", layer.id, "region"],
        value: region,
      });
    return accepted(
      patches,
      undefined,
      warnings.length === 0 ? undefined : warnings,
    );
  },
});

/** Whether the place a Link names is of an Aim among `kept`. */
function namesAimAmong(
  address: string,
  kept: ReadonlySet<RegionAimName>,
): boolean {
  const aim = address.split("/")[3];
  return [...kept].some((name) => name === aim);
}
