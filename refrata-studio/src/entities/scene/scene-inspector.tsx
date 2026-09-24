import type { DocumentView } from "@refrata/client";
import { sceneLayers, type Layer, type Scene, type Table } from "@refrata/core";
import { Play } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { InspectorHeading } from "@/inspector/fields/inspector-heading";
import { NameField } from "@/inspector/fields/name-field";
import { useCommand, useDocumentPath } from "@/lib/client";
import { useSelection } from "@/selection/selection";

/** A Scene's name, whether it is playing, and how many Layers it holds. */
export function SceneInspector({
  view,
  id,
}: {
  readonly view: DocumentView;
  readonly id: string;
}) {
  const command = useCommand(view);
  const { select } = useSelection();
  const scene = useDocumentPath<Scene>(view, ["scenes", id]);
  const layers = useDocumentPath<Table<Layer>>(view, ["layers"]) ?? {};
  const activeScene = useDocumentPath<string | null>(view, [
    "installation",
    "activeScene",
  ]);

  useEffect(() => {
    if (scene === undefined) select({ kind: "installation" });
  }, [scene, select]);
  if (scene === undefined) return null;
  const active = activeScene === scene.id;
  const count = sceneLayers(layers, scene.id).length;

  return (
    <>
      <InspectorHeading name={scene.name} id={scene.id} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 p-3">
        <NameField
          label="Name"
          value={scene.name}
          onCommit={(name) =>
            void command("scene.rename", { sceneId: id, name })
          }
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-[0.6875rem]/relaxed text-muted-foreground">
            {active
              ? "Playing: the Outputs are showing this Scene."
              : "Not playing. Play cuts the Outputs to it."}
          </span>
          <Button
            variant={active ? "default" : "outline"}
            size="sm"
            disabled={active}
            onClick={() =>
              void command("address.trigger", { address: `scene/${id}/play` })
            }
          >
            <Play /> {active ? "Playing" : "Play"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {count === 0
            ? "No Layers. Add one from the Scene's row in the navigator."
            : `${String(count)} ${count === 1 ? "Layer" : "Layers"}, Groups included.`}
        </p>
      </div>
    </>
  );
}
