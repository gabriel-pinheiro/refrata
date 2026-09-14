import type { DocumentView } from "@refrata/client";
import {
  ATTRIBUTES,
  resolveAddress,
  rowAddress,
  rowAlphaAddress,
  sameAddressValue,
  targetAttributes,
  targetLabel,
  type AddressValue,
  type AttributeFamily,
  type AttributeKey,
  type Document,
  type LookLayer,
  type LookRow,
  type ResolvedAddress,
} from "@refrata/core";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState, type KeyboardEvent } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Control } from "@/inspector/fields/address-row";
import {
  LinkedControl,
  LinkMenu,
  type RowLinks,
} from "@/inspector/fields/link-row";
import { useRowLinks } from "@/inspector/fields/use-row-links";
import { useCommand } from "@/lib/client";
import { useLatestWins } from "@/lib/use-latest-wins";
import { cn } from "@/lib/utils";

const FAMILY_LABELS: Record<AttributeFamily, string> = {
  intensity: "Intensity",
  color: "Color",
  position: "Position",
  beam: "Beam",
  gobo: "Gobo",
  control: "Control",
};

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
 * One line of a Look Layer: the Control checkbox, the Attribute, the
 * Control when the row exists (or the Controller driving it), and the row's
 * Alpha at the end. `targets` is one Target, or every Target that has the
 * Attribute for the "All Targets" section, where the value shown is the
 * common one or "mixed".
 */
function LookLine({
  view,
  document,
  layer,
  targets,
  attribute,
}: {
  readonly view: DocumentView;
  readonly document: Document;
  readonly layer: LookLayer;
  readonly targets: readonly string[];
  readonly attribute: AttributeKey;
}) {
  const command = useCommand(view);
  const rowLinks = useRowLinks(view);
  const rows = targets.map((ref) => layer.rows[ref]?.[attribute]);
  const present = rows.filter((row): row is LookRow => row !== undefined);
  const checked = present.length === targets.length;
  const indeterminate = present.length > 0 && !checked;
  const first = targets[0] ?? "";
  const resolved = resolveAddress(
    document,
    rowAddress(layer.id, first, attribute),
  );
  const single = targets.length === 1;
  const links: RowLinks | undefined =
    single && resolved !== undefined
      ? rowLinks(
          resolved,
          `${layer.name} ${targetLabel(document, first)} ${resolved.label}`,
        )
      : undefined;
  const linked = links?.link !== undefined && links.controller !== undefined;
  const mixed =
    present.length > 1 &&
    present.some((row) => !sameAddressValue(row.value, present[0]?.value));
  const send = useLatestWins((value: AddressValue) =>
    single && resolved !== undefined
      ? command("address.edit", { address: resolved.address, value })
      : command("layer.row.set", {
          layerId: layer.id,
          targets,
          attribute,
          value,
        }),
  );
  const toggle = (on: boolean): void => {
    if (on)
      void command("layer.row.set", {
        layerId: layer.id,
        targets,
        attribute,
        ...(present[0] === undefined ? {} : { value: present[0].value }),
      });
    else
      void command("layer.row.release", {
        layerId: layer.id,
        targets,
        attribute,
      });
  };
  const label = ATTRIBUTES[attribute].label;
  return (
    <div className="flex min-h-6 items-center gap-1.5">
      <Checkbox
        aria-label={`${label} row`}
        checked={checked}
        indeterminate={indeterminate}
        onCheckedChange={(next) => toggle(next)}
      />
      <span
        className={cn(
          "w-16 shrink-0 truncate text-xs",
          present.length === 0 && "text-muted-foreground",
        )}
        title={label}
      >
        {label}
      </span>
      {present.length > 0 && resolved !== undefined && (
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {linked && links !== undefined ? (
            <LinkedControl resolved={resolved} links={links} />
          ) : (
            <>
              {mixed && (
                <span className="shrink-0 text-[0.6875rem] text-muted-foreground italic">
                  mixed
                </span>
              )}
              <Control
                resolved={resolved}
                value={present[0]?.value ?? resolved.default ?? 0}
                send={send}
              />
            </>
          )}
        </div>
      )}
      {present.length === 0 && <span className="flex-1" />}
      {present.length > 0 &&
        single &&
        links !== undefined &&
        resolved !== undefined && (
          <LinkMenu resolved={resolved} links={links} />
        )}
      {present.length > 0 && (
        <AlphaField
          view={view}
          document={document}
          layer={layer}
          targets={targets}
          attribute={attribute}
          rows={present}
        />
      )}
    </div>
  );
}

/** The row's Alpha as a percent, typed; a Controller on it shows its effective value read-only. */
function AlphaField({
  view,
  document,
  layer,
  targets,
  attribute,
  rows,
}: {
  readonly view: DocumentView;
  readonly document: Document;
  readonly layer: LookLayer;
  readonly targets: readonly string[];
  readonly attribute: AttributeKey;
  readonly rows: readonly LookRow[];
}) {
  const command = useCommand(view);
  const rowLinks = useRowLinks(view);
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const first = targets[0] ?? "";
  const resolved: ResolvedAddress | undefined =
    targets.length === 1
      ? resolveAddress(document, rowAlphaAddress(layer.id, first, attribute))
      : undefined;
  const links = resolved === undefined ? undefined : rowLinks(resolved, "");
  const alphas = rows.map((row) => row.alpha ?? 1);
  const mixed = alphas.some((alpha) => alpha !== alphas[0]);
  const effective =
    links?.link !== undefined && typeof links.effective === "number"
      ? links.effective
      : (alphas[0] ?? 1);
  const shown = mixed ? "…" : String(Math.round(effective * 100));
  const commit = (cancel: boolean): void => {
    if (!cancel && draft !== undefined) {
      const typed = Number(draft.trim());
      if (Number.isFinite(typed)) {
        const alpha = Math.min(1, Math.max(0, typed / 100));
        void command("layer.row.set", {
          layerId: layer.id,
          targets,
          attribute,
          alpha,
        });
      }
    }
    setDraft(undefined);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Enter") commit(false);
    else if (event.key === "Escape") commit(true);
    else return;
    event.preventDefault();
  };
  const controlled = links?.link !== undefined;
  return (
    <span className="flex shrink-0 items-center gap-0.5" title="Alpha">
      <span className="text-[0.625rem] text-muted-foreground">α</span>
      <Input
        aria-label={`${ATTRIBUTES[attribute].label} alpha`}
        className="h-5 w-10 px-1 text-right text-[0.6875rem] tabular-nums"
        value={draft ?? shown}
        disabled={controlled}
        title={
          controlled
            ? `Alpha is controlled by ${links?.controller?.name ?? "a Controller"}`
            : "Alpha, 0 to 100%"
        }
        onFocus={() => setDraft(mixed ? "" : shown)}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onBlur={() => commit(false)}
        onKeyDown={onKeyDown}
      />
    </span>
  );
}

/** Lines for `attributes` grouped under family captions. */
function FamilyLines({
  view,
  document,
  layer,
  attributes,
  targetsOf,
}: {
  readonly view: DocumentView;
  readonly document: Document;
  readonly layer: LookLayer;
  readonly attributes: readonly AttributeKey[];
  readonly targetsOf: (attribute: AttributeKey) => readonly string[];
}) {
  return (
    <>
      {byFamily(attributes).map((group) => (
        <div key={group.family} className="grid gap-1">
          <span className="text-[0.625rem] tracking-wider text-muted-foreground/70 uppercase">
            {FAMILY_LABELS[group.family]}
          </span>
          {group.keys.map((attribute) => (
            <LookLine
              key={attribute}
              view={view}
              document={document}
              layer={layer}
              targets={targetsOf(attribute)}
              attribute={attribute}
            />
          ))}
        </div>
      ))}
    </>
  );
}

/** The "All Targets" lines: one per Attribute found across the Targets, writing to every Target that has it. */
export function AllTargetsRows({
  view,
  document,
  layer,
}: {
  readonly view: DocumentView;
  readonly document: Document;
  readonly layer: LookLayer;
}) {
  const perTarget = layer.targets.map((target) => ({
    ref: target.ref,
    attributes: targetAttributes(document, target.ref),
  }));
  const union = new Set(perTarget.flatMap((entry) => entry.attributes));
  const attributes = (Object.keys(ATTRIBUTES) as AttributeKey[]).filter((key) =>
    union.has(key),
  );
  if (attributes.length === 0)
    return (
      <p className="text-[0.6875rem]/relaxed text-muted-foreground">
        No Targets yet. Pick Elements or a Set and add the selection.
      </p>
    );
  return (
    <FamilyLines
      view={view}
      document={document}
      layer={layer}
      attributes={attributes}
      targetsOf={(attribute) =>
        perTarget
          .filter((entry) => entry.attributes.includes(attribute))
          .map((entry) => entry.ref)
      }
    />
  );
}

/** One Target's block: its label as a collapsible header, then one line per Attribute it has. */
export function TargetBlock({
  view,
  document,
  layer,
  target,
}: {
  readonly view: DocumentView;
  readonly document: Document;
  readonly layer: LookLayer;
  readonly target: string;
}) {
  const [open, setOpen] = useState(true);
  const attributes = targetAttributes(document, target);
  const count = Object.keys(layer.rows[target] ?? {}).length;
  return (
    <section className="border-t">
      <button
        type="button"
        aria-expanded={open}
        className="flex h-7 w-full items-center gap-1 px-2 text-xs hover:text-foreground"
        onClick={() => setOpen(!open)}
      >
        {open ? (
          <ChevronDown className="size-3 shrink-0" />
        ) : (
          <ChevronRight className="size-3 shrink-0" />
        )}
        <span className="min-w-0 flex-1 truncate text-left">
          {targetLabel(document, target)}
        </span>
        <span className="shrink-0 text-[0.6875rem] text-muted-foreground tabular-nums">
          {count === 0 ? "released" : `${String(count)} set`}
        </span>
      </button>
      {open && (
        <div className="grid gap-1.5 px-3 pt-0.5 pb-3">
          {attributes.length === 0 ? (
            <p className="text-[0.6875rem]/relaxed text-muted-foreground">
              Nothing here has a Parameter.
            </p>
          ) : (
            <FamilyLines
              view={view}
              document={document}
              layer={layer}
              attributes={attributes}
              targetsOf={() => [target]}
            />
          )}
        </div>
      )}
    </section>
  );
}
