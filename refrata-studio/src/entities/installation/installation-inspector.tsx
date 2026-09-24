import type { DocumentView } from "@refrata/client";
import {
  resolveAddress,
  type Installation,
  type Scene,
  type Table,
} from "@refrata/core";

import { AddressRow } from "@/inspector/fields/address-row";
import { InspectorHeading } from "@/inspector/fields/inspector-heading";
import { InspectorSection } from "@/inspector/fields/inspector-section";
import { NameField } from "@/inspector/fields/name-field";
import { useRowLinks } from "@/inspector/fields/use-row-links";
import { useCommand, useDocumentPath } from "@/lib/client";

import { FixtureTypesSection } from "./fixture-types-section";

/** Settings of the Installation itself: its name, the grand Master (a Controller can take it), what is playing, and its Fixture Types against the library. */
export function InstallationInspector({
  view,
}: {
  readonly view: DocumentView;
}) {
  const command = useCommand(view);
  const rowLinks = useRowLinks(view);
  const installation = useDocumentPath<Installation>(view, ["installation"]);
  const scenes = useDocumentPath<Table<Scene>>(view, ["scenes"]) ?? {};
  if (installation === undefined) return null;
  const master = resolveAddress(
    { ...view.get(), installation } as Parameters<typeof resolveAddress>[0],
    "installation/master",
  );
  const active =
    installation.activeScene === null
      ? undefined
      : scenes[installation.activeScene];

  return (
    <>
      <InspectorHeading name={installation.name} id={installation.id} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 p-3">
        <NameField
          label="Name"
          value={installation.name}
          onCommit={(name) => void command("installation.rename", { name })}
        />
      </div>
      <InspectorSection storageKey="playback" label="Playback">
        {master !== undefined && (
          <AddressRow
            resolved={master}
            value={installation.master}
            description="Scales every dimmer after Resolve"
            onEdit={(value) =>
              command("address.edit", { address: master.address, value })
            }
            links={rowLinks(master, "Master")}
          />
        )}
        <p className="text-[0.6875rem]/relaxed text-muted-foreground">
          {active === undefined
            ? "No Scene is playing: every fixture rests at its Defaults."
            : `Playing “${active.name}”.`}
        </p>
      </InspectorSection>
      <FixtureTypesSection view={view} />
    </>
  );
}
