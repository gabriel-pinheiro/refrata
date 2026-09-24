import {
  orderedEntries,
  visualDefinition,
  type Document,
  type ResolvedAddress,
} from "@refrata/core";

/** Where a picker lists an Address: its heading, its owner, and the heading's place among the others. */
export interface AddressPlace {
  readonly group: string;
  readonly owner: string;
  /** Shown dimmed after the label: a Visual Layer's Visual. */
  readonly detail?: string | undefined;
  readonly rank: number;
}

/**
 * Places Addresses in a picker. A Layer's Addresses sit under their Scene's
 * name, the Scenes in navigator order between "Scenes" (their play
 * triggers) and "Controllers", and each Layer's stay together in the order
 * the Scene lists its Layers, so a show of eighty Layers reads Scene by
 * Scene and Layer by Layer. A Look row's owner names its row after the
 * Layer ("Look · All Targets", "Look · Par 1"), so two rows with the same
 * label read apart. An Element's Highlight is a programming tool and has no
 * place.
 */
export function addressPlacer(
  document: Document,
): (resolved: ResolvedAddress) => AddressPlace | undefined {
  const scenePosition = new Map<string, number>(
    orderedEntries(document.scenes).map((scene, index) => [scene.id, index]),
  );
  const layerPosition = new Map<string, number>(
    orderedEntries(document.layers).map((layer, index) => [layer.id, index]),
  );
  return (resolved) => {
    const [kind, id = ""] = resolved.address.split("/");
    const owner = resolved.owner ?? "";
    switch (kind) {
      case "installation":
        return { group: "Installation", owner: "", rank: 0 };
      case "scene":
        return { group: "Scenes", owner, rank: 1 };
      case "controller":
        return { group: "Controllers", owner, rank: 3 };
      case "macro":
        return { group: "Macros", owner, rank: 4 };
      case "layer": {
        const layer = document.layers[id];
        if (layer === undefined) return undefined;
        return {
          group: document.scenes[layer.sceneId]?.name ?? "",
          owner: resolved.owner ?? layer.name,
          detail:
            layer.kind === "visual"
              ? visualDefinition(layer.visual)?.name
              : undefined,
          rank:
            2 +
            (scenePosition.get(layer.sceneId) ?? 0) / 1e3 +
            (layerPosition.get(id) ?? 0) / 1e6,
        };
      }
      default:
        return undefined;
    }
  };
}
