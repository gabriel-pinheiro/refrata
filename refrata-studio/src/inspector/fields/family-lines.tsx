import {
  ATTRIBUTES,
  type AttributeFamily,
  type AttributeKey,
} from "@refrata/core";
import type { ReactNode } from "react";

const FAMILY_LABELS: Record<AttributeFamily, string> = {
  intensity: "Intensity",
  color: "Color",
  position: "Position",
  beam: "Beam",
  gobo: "Gobo",
  control: "Control",
};

const AIM_AXES = ["pan", "tilt"] as const satisfies readonly AttributeKey[];

/** Whether a row ref's Attributes hold both halves of an Aim, so one Aim line stands for the two. */
export function hasAim(attributes: readonly AttributeKey[]): boolean {
  return AIM_AXES.every((axis) => attributes.includes(axis));
}

/** Attributes grouped by family, in vocabulary order. */
function byFamily(attributes: readonly AttributeKey[]): readonly {
  readonly family: AttributeFamily;
  readonly keys: AttributeKey[];
}[] {
  const groups: { family: AttributeFamily; keys: AttributeKey[] }[] = [];
  for (const key of attributes) {
    const family = ATTRIBUTES[key].family;
    const last = groups[groups.length - 1];
    if (last?.family === family) last.keys.push(key);
    else groups.push({ family, keys: [key] });
  }
  return groups;
}

/**
 * Lines for `attributes` grouped under family captions, for the rows of
 * one owner, a Look Layer's or a Preset's: `line` draws one Attribute, and
 * `pan` and `tilt` together are the one line `aim` draws.
 */
export function FamilyLines({
  attributes,
  aim,
  line,
}: {
  readonly attributes: readonly AttributeKey[];
  readonly aim: () => ReactNode;
  readonly line: (attribute: AttributeKey) => ReactNode;
}) {
  const paired = hasAim(attributes);
  return (
    <>
      {byFamily(attributes).map((group) => (
        <div
          key={group.family}
          className="grid grid-cols-[minmax(0,1fr)] gap-1"
        >
          <span className="text-[0.625rem] tracking-wider text-muted-foreground/70 uppercase">
            {FAMILY_LABELS[group.family]}
          </span>
          {group.keys.map((attribute) =>
            paired && attribute === "tilt" ? null : paired &&
              attribute === "pan" ? (
              <div key="aim" className="contents">
                {aim()}
              </div>
            ) : (
              <div key={attribute} className="contents">
                {line(attribute)}
              </div>
            ),
          )}
        </div>
      ))}
    </>
  );
}
