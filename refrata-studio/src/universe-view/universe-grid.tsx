import type { DocumentView } from "@refrata/client";
import {
  settings,
  testerHolds,
  UNIVERSE_SIZE,
  universeMap,
  universeRuns,
  type Tester,
} from "@refrata/core";
import { useEffect, useMemo, useRef, useState } from "react";

import { pickModeOf, useSelection } from "@/selection/selection";

import { AddressCell } from "./address-cell";
import { columnsFor, labelSpan, type Columns } from "./universe-layout";

/** The tables the occupancy of a Universe is read from; a change elsewhere in the document leaves the grid alone. */
export type Rig = Pick<
  Parameters<typeof universeMap>[0],
  "fixtures" | "fixtureTypes"
>;

/**
 * The 512 addresses of one Universe as rows of 32, 16 or 8 cells, whichever
 * keeps a cell wide enough for the column's width. Neighbouring Fixtures
 * alternate tints; Fixtures in the Selection are outlined; Fixture names
 * are drawn when cells are wide enough.
 */
export function UniverseGrid({
  view,
  rig,
  universeId,
  tester,
}: {
  readonly view: DocumentView;
  readonly rig: Rig;
  readonly universeId: string;
  readonly tester: Tester | null;
}) {
  const { selected, select } = useSelection();
  const container = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<{
    columns: Columns;
    labels: boolean;
  }>({ columns: 16, labels: true });
  useEffect(() => {
    const element = container.current;
    if (element === null) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? 0;
      const columns = columnsFor(width, settings.universeView.minCellPx);
      const labels = width / columns >= settings.universeView.labelMinCellPx;
      setLayout((previous) =>
        previous.columns === columns && previous.labels === labels
          ? previous
          : { columns, labels },
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const map = useMemo(() => universeMap(rig, universeId), [rig, universeId]);
  const tones = useMemo(() => {
    const byFixture = new Map<string, number>();
    for (const run of universeRuns(rig, universeId))
      if (run.fixture !== undefined)
        byFixture.set(run.fixture.id, byFixture.size);
    return byFixture;
  }, [rig, universeId]);
  const selectedFixtures = new Set(
    selected.flatMap((item) => (item.kind === "fixture" ? [item.id] : [])),
  );
  const heldHere = tester?.universeId === universeId ? tester : null;
  const addresses = Array.from({ length: UNIVERSE_SIZE }, (_, i) => i + 1);
  return (
    <div
      ref={container}
      className="grid gap-px"
      style={{
        gridTemplateColumns: `repeat(${String(layout.columns)}, minmax(0, 1fr))`,
      }}
    >
      {addresses.map((address) => {
        const occupied = map.get(address);
        return (
          <AddressCell
            key={address}
            view={view}
            universeId={universeId}
            address={address}
            occupied={occupied}
            tone={
              occupied === undefined ? 0 : (tones.get(occupied.fixture.id) ?? 0)
            }
            labelSpan={
              occupied === undefined || !layout.labels
                ? 0
                : labelSpan(
                    address,
                    occupied.start,
                    occupied.end,
                    layout.columns,
                  )
            }
            held={
              heldHere !== null &&
              testerHolds(heldHere, address) &&
              heldHere.values[address - heldHere.address] !== null
            }
            selected={
              occupied !== undefined &&
              selectedFixtures.has(occupied.fixture.id)
            }
            onSelect={(fixtureId, event) =>
              select({ kind: "fixture", id: fixtureId }, pickModeOf(event))
            }
          />
        );
      })}
    </div>
  );
}
