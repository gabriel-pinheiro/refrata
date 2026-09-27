import type { DocumentView } from "@refrata/client";
import {
  ALL_ELEMENTS_LABEL,
  ALL_TARGETS_REF,
  ATTRIBUTE_KEYS,
  ATTRIBUTES,
  isPresetLink,
  presetShownAttributes,
  resolveAddress,
  type Document,
  type Link,
  type Preset,
  type Table,
  type ValuePreset,
} from "@refrata/core";
import { Plus, SquareArrowOutUpRight } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TargetPicker } from "@/entities/target/target-picker";
import { InspectorHeading } from "@/inspector/fields/inspector-heading";
import { InspectorSection } from "@/inspector/fields/inspector-section";
import { NameField } from "@/inspector/fields/name-field";
import { useCommand, useDocumentPath, useSignal } from "@/lib/client";
import { useSelection } from "@/selection/selection";

import { ElementBlock, ElementList, PresetLines } from "./preset-elements";

/**
 * A Preset's name, its All Elements rows, its Elements each with their
 * rows, and the Look Layer rows linked to it. "Add Elements" opens the
 * picker over the whole rig; a Fixture Set adds the members it has now. A
 * Group shows only its name.
 */
export function PresetInspector({
  view,
  id,
}: {
  readonly view: DocumentView;
  readonly id: string;
}) {
  const command = useCommand(view);
  const { select } = useSelection();
  const [picking, setPicking] = useState(false);
  const preset = useDocumentPath<Preset>(view, ["presets", id]);
  const links = useDocumentPath<Table<Link>>(view, ["links"]) ?? {};
  // Rows read Fixtures and their Modes, and linked rows their Layers.
  const document = useSignal(view.document);
  useEffect(() => {
    if (preset === undefined) select({ kind: "installation" });
  }, [preset, select]);
  if (preset === undefined || document === undefined) return null;
  return (
    <>
      <InspectorHeading name={preset.name} id={preset.id} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 p-3">
        <NameField
          label="Name"
          value={preset.name}
          onCommit={(name) =>
            void command("preset.rename", { presetId: id, name })
          }
        />
      </div>
      {preset.kind === "preset" && (
        <>
          <InspectorSection
            storageKey="preset-all"
            label={ALL_ELEMENTS_LABEL}
            actions={<AddRow view={view} document={document} preset={preset} />}
          >
            <AllRows view={view} document={document} preset={preset} />
          </InspectorSection>
          <InspectorSection
            storageKey="preset-elements"
            label="Elements"
            actions={
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setPicking(true)}
              >
                <Plus /> Add Elements
              </Button>
            }
          >
            {preset.elements.length === 0 ? (
              <p className="text-[0.6875rem]/relaxed text-muted-foreground">
                {preset.name} lists no Elements. Add some here, or select
                Fixtures and add them to it from there.
              </p>
            ) : (
              <ElementList view={view} document={document} preset={preset} />
            )}
          </InspectorSection>
          {preset.elements.map((element) => (
            <ElementBlock
              key={element}
              view={view}
              document={document}
              preset={preset}
              element={element}
            />
          ))}
          <LinkedRows document={document} links={links} preset={preset} />
        </>
      )}
      {picking && preset.kind === "preset" && (
        <TargetPicker
          view={view}
          title={`Add Elements to ${preset.name}`}
          members={false}
          taken={preset.elements}
          submitLabel={(count) => `Add ${count > 0 ? String(count) : ""}`}
          onSubmit={(refs) =>
            void command("preset.elements.add", { presetId: id, refs })
          }
          onClose={() => setPicking(false)}
        />
      )}
    </>
  );
}

interface PresetProps {
  readonly view: DocumentView;
  readonly document: Document;
  readonly preset: ValuePreset;
}

/** The All Elements lines: the Attributes found across the Preset's Elements and the ones it holds a row for. */
function AllRows({ view, document, preset }: PresetProps) {
  const attributes = presetShownAttributes(document, preset, ALL_TARGETS_REF);
  if (attributes.length === 0)
    return (
      <p className="text-[0.6875rem]/relaxed text-muted-foreground">
        Rows here reach every Element without its own. Add a row, or add
        Elements below.
      </p>
    );
  return (
    <PresetLines
      view={view}
      document={document}
      preset={preset}
      rowRef={ALL_TARGETS_REF}
      attributes={attributes}
    />
  );
}

/** Ticks on an All Elements row for an Attribute none of the Preset's Elements has yet, so a Preset of colour alone needs no Elements. */
function AddRow({ view, document, preset }: PresetProps) {
  const command = useCommand(view);
  const shown = presetShownAttributes(document, preset, ALL_TARGETS_REF);
  const others = ATTRIBUTE_KEYS.filter((key) => !shown.includes(key));
  if (others.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="xs" />}>
        <Plus /> Add row
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-72">
        {others.map((attribute) => (
          <DropdownMenuItem
            key={attribute}
            onClick={() =>
              void command("preset.row.set", {
                presetId: preset.id,
                elements: [ALL_TARGETS_REF],
                attribute,
              })
            }
          >
            {ATTRIBUTES[attribute].label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The Look Layer rows linked to the Preset, each opening its Layer. */
function LinkedRows({
  document,
  links,
  preset,
}: {
  readonly document: Document;
  readonly links: Table<Link>;
  readonly preset: ValuePreset;
}) {
  const { select } = useSelection();
  const rows = Object.values(links)
    .filter(isPresetLink)
    .filter((link) => link.presetId === preset.id)
    .flatMap((link) => {
      const resolved = resolveAddress(document, link.address);
      const layerId = resolved?.path[1];
      return resolved === undefined || layerId === undefined
        ? []
        : [
            {
              link,
              layerId,
              owner: resolved.owner ?? "",
              label: resolved.label,
            },
          ];
    })
    .sort((a, b) =>
      `${a.owner} ${a.label}`.localeCompare(`${b.owner} ${b.label}`),
    );
  return (
    <InspectorSection storageKey="preset-links" label="Linked rows">
      {rows.length === 0 ? (
        <p className="text-[0.6875rem]/relaxed text-muted-foreground">
          No row is linked to {preset.name}. Link one from its row in a Look
          Layer.
        </p>
      ) : (
        <ul
          className="grid grid-cols-[minmax(0,1fr)] gap-px"
          aria-label="Linked rows"
        >
          {rows.map(({ link, layerId, owner, label }) => (
            <li key={link.id}>
              <button
                type="button"
                className="flex h-6 w-full items-center gap-1.5 rounded-sm pl-1 text-left text-xs hover:bg-sidebar-accent/60"
                title={`Go to ${owner}`}
                onClick={() => select({ kind: "layer", id: layerId })}
              >
                <span className="min-w-0 flex-1 truncate">
                  <span className="text-muted-foreground">{owner}</span> {label}
                </span>
                <SquareArrowOutUpRight className="size-3 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </InspectorSection>
  );
}
