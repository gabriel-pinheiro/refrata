import type { DocumentView } from "@refrata/client";
import {
  ATTRIBUTES,
  axisBounds,
  REGION_AXES,
  regionAim,
  regionAimLabel,
  regionPlace,
  regionPresetValues,
  regionReach,
  type Document,
  type Region,
  type RegionAimName,
  type ResolvedAddress,
  type VisualLayer,
} from "@refrata/core";

import { AimControl, type AimAxis } from "@/inspector/fields/aim-row";
import {
  entryText,
  PresetEntries,
  type ShownEntry,
} from "@/inspector/fields/preset-entries";
import { useAimLinks } from "@/inspector/fields/use-aim-links";
import { useRegionLinks } from "@/inspector/fields/use-region-links";
import { useCommand } from "@/lib/client";

/**
 * One Aim of a Region as an Aim line: its name, then the Aim control over
 * its two places, which types and nudges the degrees every Target takes,
 * or links either axis, or both, to a Preset, from which each Element
 * takes its own. Under a linked Aim, what each Element takes. On the Blend
 * Mode Add the Aim is an offset: it has no limits but the vocabulary's and
 * takes no Preset.
 */
export function RegionAimLine({
  view,
  document,
  layer,
  region,
  aim,
}: {
  readonly view: DocumentView;
  readonly document: Document;
  readonly layer: VisualLayer;
  readonly region: Region;
  readonly aim: RegionAimName;
}) {
  const command = useCommand(view);
  const regionLinks = useRegionLinks(view);
  const aimLinks = useAimLinks(view);
  const typed = regionAim(region, aim);
  if (typed === undefined) return null;
  const relative = layer.blendMode === "add";
  const label = regionAimLabel(aim, layer.blendMode);
  const axis = (key: (typeof REGION_AXES)[number]): AimAxis => {
    const place = regionPlace(layer.id, aim, key);
    const resolved: ResolvedAddress = {
      address: place,
      label: `${label} ${ATTRIBUTES[key].label}`,
      owner: layer.name,
      path: ["layers", layer.id, "region", aim, key],
      type: "number",
      default: 0,
      range: { ...axisBounds(key), unit: "°" },
    };
    return {
      resolved,
      value: typed[key],
      links: regionLinks(place, typed[key], !relative),
      reach: relative ? [] : regionReach(document, layer, key),
    };
  };
  const pan = axis("pan");
  const tilt = axis("tilt");
  const pair = aimLinks(
    { address: pan.resolved.address, links: pan.links },
    { address: tilt.resolved.address, links: tilt.links },
  );
  return (
    <div className="flex min-h-6 flex-wrap items-center gap-x-1.5 gap-y-1">
      <span
        className="min-w-16 shrink-0 self-start pt-0.5 text-xs whitespace-nowrap"
        title={
          relative
            ? "How far from what is below the box is centered"
            : `${label}: pan and tilt`
        }
      >
        {label}
      </span>
      <div className="flex min-w-0 flex-1 basis-40">
        <AimControl
          label={label}
          pan={pan}
          tilt={tilt}
          pair={pair}
          onEdit={(value) =>
            command("layer.region.set", { layerId: layer.id, [aim]: value })
          }
        >
          <PresetEntries
            label={label}
            entries={aimEntries(document, layer, pan, tilt)}
          />
        </AimControl>
      </div>
    </div>
  );
}

/** What each Element the Layer reaches takes from the Presets driving the Aim, pan then tilt; an axis no Preset drives shows a dash. Empty while none drives either. */
function aimEntries(
  document: Document,
  layer: VisualLayer,
  pan: AimAxis,
  tilt: AimAxis,
): readonly ShownEntry[] {
  if (pan.links.preset === undefined && tilt.links.preset === undefined)
    return [];
  const entries = new Map<
    string,
    { label: string; parts: (string | undefined)[] }
  >();
  [pan, tilt].forEach((axis, index) => {
    const key = REGION_AXES[index];
    if (key === undefined) return;
    const preset = axis.links.preset;
    const reached =
      preset === undefined
        ? regionReach(document, layer, key).map((range) => ({
            ref: range.ref,
            label: range.label,
            text: "-",
          }))
        : regionPresetValues(document, layer, key, preset).map((entry) => ({
            ref: entry.ref,
            label: entry.label,
            text: entryText(axis.resolved, entry.value),
          }));
    for (const entry of reached) {
      const shown = entries.get(entry.ref) ?? {
        label: entry.label,
        parts: ["-", "-"],
      };
      shown.parts[index] = entry.text;
      entries.set(entry.ref, shown);
    }
  });
  return [...entries].map(([ref, entry]) => ({ ref, ...entry }));
}
