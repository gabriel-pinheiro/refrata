import type { DocumentView } from "@refrata/client";
import type { FixtureType } from "@refrata/core";
import { useCallback } from "react";
import { toast } from "sonner";

import { useClient } from "@/lib/client";

/**
 * Reloads Fixture Types the Installation holds from the library's own
 * files, as one `fixture.reload`: one undo step whether it is one type or
 * all of them. What the reload took with it (Set members, Layer Targets,
 * Links on Element keys a Mode no longer has) is shown once; a refusal
 * (a lost Mode, an overlapping Footprint) says which Fixture to fix.
 */
export function useReloadFixtureTypes(
  view: DocumentView,
): (keys: readonly string[], what: string) => void {
  const client = useClient();
  const { documentId } = view;
  return useCallback(
    (keys, what) => {
      void Promise.all(
        keys.map((key) =>
          client
            .request<{ type: FixtureType }>("library.get", {
              key,
              libraryOnly: true,
            })
            .then((reply) => reply.type),
        ),
      )
        .then((types) =>
          client.command<{ readonly warnings?: readonly string[] }>(
            documentId,
            "fixture.reload",
            { types },
          ),
        )
        .then(
          (result) => {
            const warnings = result.warnings ?? [];
            if (warnings.length > 0)
              toast.warning(`Reloaded ${what}`, {
                description: warnings.join("\n"),
              });
          },
          (failure: unknown) => {
            toast.error(`Could not reload ${what}`, {
              description:
                failure instanceof Error ? failure.message : String(failure),
            });
          },
        );
    },
    [client, documentId],
  );
}
