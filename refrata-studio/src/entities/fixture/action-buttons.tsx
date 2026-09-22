import type { DocumentView } from "@refrata/client";
import { fixtureModeOf, parseElementRef, type Document } from "@refrata/core";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCommand, useDocumentPath } from "@/lib/client";

/**
 * One button per Action the Fixture's Mode declares, on its root Element:
 * a click fires `fixture/<id>/action/<key>` and the runtime holds the byte
 * for the declared seconds, during which the button reads as running.
 */
export function ActionButtons({
  view,
  elementId,
}: {
  readonly view: DocumentView;
  readonly elementId: string;
}) {
  const command = useCommand(view);
  const parsed = parseElementRef(elementId);
  const fixtureId = parsed?.fixtureId ?? "";
  const fixture = useDocumentPath<Document["fixtures"][string]>(view, [
    "fixtures",
    fixtureId,
  ]);
  const fixtureTypes =
    useDocumentPath<Document["fixtureTypes"]>(view, ["fixtureTypes"]) ?? {};
  const running =
    useDocumentPath<Document["operational"]["actions"]>(view, [
      "operational",
      "actions",
    ]) ?? {};
  if (parsed?.key !== "root" || fixture?.kind !== "fixture") return null;
  const actions = fixtureModeOf({ fixtureTypes }, fixture)?.actions ?? {};
  return (
    <>
      {Object.entries(actions).map(([key, action]) => {
        const isRunning = running[`${fixtureId}/${key}`] === true;
        return (
          <Button
            key={key}
            variant="outline"
            size="xs"
            disabled={isRunning}
            title={`${action.name}: holds channel “${action.channel}” at ${String(action.byte)} for ${String(action.seconds)} s`}
            onClick={() =>
              void command("address.trigger", {
                address: `fixture/${fixtureId}/action/${key}`,
              })
            }
          >
            <RotateCcw /> {isRunning ? `${action.name}…` : action.name}
          </Button>
        );
      })}
    </>
  );
}
