import {
  footprintOf,
  wireBytes,
  type ChannelRow,
  type Fixture,
  type PatchedFixture,
  type Tester,
} from "@refrata/core";
import { useCallback, useMemo } from "react";

import { useCommand, useDocumentPath } from "@/lib/client";

import { useFixtureEditor } from "./editor-state";
import { heldValues, holdsFixture } from "./probe-range";
import type { Scope } from "./scope";

/**
 * The probe: the DMX Tester's hold aimed at one Fixture of the type being
 * edited. It adds no state of its own; it is "holding" when the tester's
 * range is exactly that Fixture's.
 */
export interface Probe {
  readonly fixture: PatchedFixture;
  /** The held value of each Channel by key, over its whole width, most significant byte first. */
  readonly values: Readonly<Record<string, number>>;
  /** Writes a Channel's value to the addresses it takes. */
  readonly set: (row: ChannelRow, value: number) => void;
}

/** The probe while it holds a Fixture of this Mode, else null. */
export function useProbe(scope: Scope): Probe | null {
  const { view, typeKey, modeKey, mode, rows } = scope;
  const command = useCommand(view);
  const { probeFixtureId } = useFixtureEditor();
  const tester = useDocumentPath<Tester | null>(view, [
    "operational",
    "tester",
  ]);
  const aimed = useDocumentPath<Fixture>(view, [
    "fixtures",
    probeFixtureId ?? "",
  ]);
  const fixture =
    aimed?.kind === "fixture" &&
    aimed.typeKey === typeKey &&
    aimed.modeKey === modeKey
      ? aimed
      : undefined;
  const address = fixture?.patch?.address;
  const set = useCallback(
    (row: ChannelRow, value: number) => {
      if (address === undefined) return;
      const first = address + row.address - 1;
      void command("tester.set", {
        values: Object.fromEntries(
          wireBytes(row.bytes, value).map((byte, index) => [
            String(first + index),
            byte,
          ]),
        ),
      });
    },
    [command, address],
  );
  const held =
    tester != null && holdsFixture(tester, fixture, footprintOf(mode))
      ? tester
      : null;
  return useMemo(
    () =>
      held === null || fixture === undefined
        ? null
        : { fixture, values: heldValues(rows, held), set },
    [held, fixture, rows, set],
  );
}
