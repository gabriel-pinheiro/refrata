import {
  footprintOf,
  type Fixture,
  type Table,
  type Tester,
  type Universe,
} from "@refrata/core";
import { Eraser, Play, Square } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { useFixtureEditor } from "@/entities/fixture-type/editor-state";
import type { Scope } from "@/entities/fixture-type/scope";
import {
  holdsFixture,
  probeFixtures,
} from "@/entities/fixture-type/probe-range";
import { Choice } from "@/inspector/fields/form-inputs";
import { useCommand, useDocumentPath } from "@/lib/client";
import { cn } from "@/lib/utils";

interface Range {
  readonly fixtureId: string;
  readonly universeId: string;
  readonly address: number;
  readonly count: number;
}

const STRIP =
  "flex min-h-9 shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b px-3 py-1.5 text-xs";

/**
 * The probe's strip: the DMX Tester's hold aimed at one Fixture of the
 * type. Nothing is held until a Fixture is picked and Hold is pressed, so
 * opening the editor mid-show changes no output; Hold then sends 0 to every
 * Channel of that Fixture, as the tester does. An edit that changes the
 * Footprint while holding is followed: the new range is held.
 */
export function ProbeBar({ scope }: { readonly scope: Scope }) {
  const { view, typeKey, modeKey, mode } = scope;
  const command = useCommand(view);
  const { probeFixtureId, aimProbe } = useFixtureEditor();
  const fixtures = useDocumentPath<Table<Fixture>>(view, ["fixtures"]) ?? {};
  const universes = useDocumentPath<Table<Universe>>(view, ["universes"]) ?? {};
  const tester = useDocumentPath<Tester | null>(view, [
    "operational",
    "tester",
  ]);
  const candidates = probeFixtures(fixtures, typeKey, modeKey);
  const fixture = candidates.find((each) => each.id === probeFixtureId);
  const footprint = footprintOf(mode);
  const holding = holdsFixture(tester, fixture, footprint);
  const fixtureId = fixture?.id;
  const universeId = fixture?.patch?.universeId;
  const address = fixture?.patch?.address;
  const held = useRef<Range | undefined>(undefined);
  useEffect(() => {
    const before = held.current;
    const range =
      fixtureId === undefined ||
      universeId === undefined ||
      address === undefined
        ? undefined
        : { fixtureId, universeId, address, count: footprint };
    held.current = holding ? range : undefined;
    if (holding || before === undefined || range === undefined) return;
    if (tester == null || before.fixtureId !== range.fixtureId) return;
    // The range this probe held is still the tester's, and the Fixture's own moved under it: hold where it is now.
    if (
      tester.universeId === before.universeId &&
      tester.address === before.address &&
      tester.values.length === before.count
    )
      void command("tester.hold", {
        universeId: range.universeId,
        address: range.address,
        count: range.count,
      });
  }, [holding, fixtureId, universeId, address, footprint, tester, command]);

  if (candidates.length === 0) {
    const patched = Object.values(fixtures).some(
      (each) =>
        each.kind === "fixture" &&
        each.typeKey === typeKey &&
        each.patch !== null,
    );
    return (
      <div className={cn(STRIP, "text-muted-foreground")}>
        {patched
          ? "No patched Fixture is on this Mode to probe."
          : "No patched Fixture of this type to probe. Add one to try it on the rig."}
      </div>
    );
  }
  const hold = (
    patch: { readonly universeId: string; readonly address: number } | null,
  ): void => {
    if (patch !== null)
      void command("tester.hold", {
        universeId: patch.universeId,
        address: patch.address,
        count: footprint,
      });
  };
  return (
    <div className={cn(STRIP, holding && "bg-amber-400/10")}>
      <span className="text-muted-foreground">Probe</span>
      <Choice
        className="w-52 max-w-full"
        value={fixture?.id ?? null}
        placeholder="Pick a Fixture"
        options={candidates.map((each) => ({
          value: each.id,
          label: `${each.name}, ${universes[each.patch?.universeId ?? ""]?.name ?? ""} ${String(each.patch?.address ?? "")}`,
        }))}
        onChange={(next) => {
          aimProbe(next);
          const aimed = candidates.find((each) => each.id === next);
          if (holding && aimed !== undefined) hold(aimed.patch);
        }}
      />
      {holding ? (
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void command("tester.zero", {})}
          >
            <Eraser /> Zero all
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void command("tester.release", {})}
          >
            <Square /> Release
          </Button>
          <span className="flex min-w-0 items-center gap-1.5 text-amber-300">
            <span className="size-1.5 shrink-0 rounded-full bg-amber-400" />
            Holding its Channels over the show
          </span>
        </>
      ) : (
        <>
          <Button
            size="sm"
            disabled={fixture === undefined}
            onClick={() => hold(fixture?.patch ?? null)}
          >
            <Play /> Hold
          </Button>
          <span className="min-w-0 text-muted-foreground">
            Not holding. Hold sends 0 to every Channel of the Fixture, as the
            DMX Tester does.
          </span>
        </>
      )}
    </div>
  );
}
