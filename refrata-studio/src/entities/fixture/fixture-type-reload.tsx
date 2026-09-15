import type { DocumentView } from "@refrata/client";
import {
  fixturesOfType,
  type Fixture,
  type FixtureTypeDrift,
  type Table,
} from "@refrata/core";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useDocumentPath } from "@/lib/client";

import { useReloadFixtureTypes } from "./use-reload-fixture-types";

const DRIFT_TEXT: Record<FixtureTypeDrift, string> = {
  current: "Same as the library.",
  stale: "The library has a newer definition.",
  missing: "Not in the library: this Installation's copy is the only one.",
};

/**
 * Whether a Fixture's type still matches the library file, and the button
 * that reloads it. Every Fixture of the type takes the reload, so the
 * button says how many there are when it is more than this one.
 */
export function FixtureTypeReload({
  view,
  typeKey,
  model,
}: {
  readonly view: DocumentView;
  readonly typeKey: string;
  readonly model: string;
}) {
  const drift = useDocumentPath<FixtureTypeDrift>(view, [
    "live",
    "fixtureTypes",
    typeKey,
  ]);
  const fixtures = useDocumentPath<Table<Fixture>>(view, ["fixtures"]) ?? {};
  const reload = useReloadFixtureTypes(view);
  const count = fixturesOfType(fixtures, typeKey).length;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {drift !== undefined && (
        <p
          className={
            drift === "stale"
              ? "min-w-0 flex-1 text-[0.6875rem] text-amber-400"
              : "min-w-0 flex-1 text-[0.6875rem] text-muted-foreground"
          }
        >
          {DRIFT_TEXT[drift]}
        </p>
      )}
      <Button
        variant="outline"
        size="xs"
        disabled={drift !== "stale"}
        onClick={() => reload([typeKey], model)}
      >
        <RefreshCw /> Reload from library
        {count > 1 ? ` (${String(count)} Fixtures)` : ""}
      </Button>
    </div>
  );
}
