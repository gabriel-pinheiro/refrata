import type { DocumentView } from "@refrata/client";
import type { FixtureTypeDrift } from "@refrata/core";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useReloadFixtureTypes } from "@/entities/fixture/use-reload-fixture-types";
import { InspectorSection } from "@/inspector/fields/inspector-section";
import { useDocumentPath } from "@/lib/client";

/**
 * The Installation's Fixture Types against the library: how many it holds,
 * how many differ from their library file, and one button reloading every
 * one that differs as a single undo step. Types gone from the library are
 * counted and left alone.
 */
export function FixtureTypesSection({ view }: { readonly view: DocumentView }) {
  const drifts =
    useDocumentPath<Readonly<Record<string, FixtureTypeDrift>>>(view, [
      "live",
      "fixtureTypes",
    ]) ?? {};
  const reload = useReloadFixtureTypes(view);
  const keys = Object.keys(drifts);
  const stale = keys.filter((key) => drifts[key] === "stale");
  const missing = keys.filter((key) => drifts[key] === "missing");
  const plural = (count: number, noun: string): string =>
    `${String(count)} ${noun}${count === 1 ? "" : "s"}`;
  return (
    <InspectorSection storageKey="fixture-types" label="Fixture Types">
      <p className="text-[0.6875rem]/relaxed text-muted-foreground">
        {keys.length === 0
          ? "No Fixture Types yet: adding a Fixture copies its type in."
          : [
              `${plural(keys.length, "type")} copied into this Installation`,
              stale.length === 0
                ? "all match the library"
                : `${String(stale.length)} ${stale.length === 1 ? "differs" : "differ"} from the library`,
              ...(missing.length === 0
                ? []
                : [`${String(missing.length)} no longer in it`]),
            ].join(", ") + "."}
      </p>
      <Button
        variant="outline"
        size="sm"
        disabled={stale.length === 0}
        onClick={() =>
          reload(
            stale,
            stale.length === 1
              ? "1 Fixture Type"
              : plural(stale.length, "Fixture Type"),
          )
        }
      >
        <RefreshCw /> Reload all from library
      </Button>
    </InspectorSection>
  );
}
