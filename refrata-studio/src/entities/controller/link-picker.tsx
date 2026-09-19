import type { DocumentView } from "@refrata/client";
import {
  linkAt,
  linkable,
  listAddresses,
  type Controller,
  type Document,
} from "@refrata/core";
import { useMemo } from "react";

import {
  AddressPicker,
  type PickerCandidate,
} from "@/inspector/fields/address-picker";
import { addressPlacer } from "@/inspector/fields/address-place";
import { useCommand, useSignal } from "@/lib/client";

/**
 * Picks the Addresses a Controller will drive: every compatible one in the
 * Installation, Layers under their Scene, and linked in one step. Built for
 * "this Controller onto the same Parameter of thirty things": type two
 * words, select all, link.
 */
export function LinkPicker({
  view,
  controller,
  onClose,
}: {
  readonly view: DocumentView;
  readonly controller: Controller & { readonly kind: "number" | "color" };
  readonly onClose: () => void;
}) {
  const command = useCommand(view);
  const document = useSignal(view.document);
  const candidates = useMemo(
    () => (document === undefined ? [] : collect(document, controller)),
    [document, controller],
  );
  return (
    <AddressPicker
      title={`Link to ${controller.name}`}
      testId="link-picker"
      candidates={candidates}
      empty="Nothing in the Installation can be linked yet."
      submitLabel={(count) => `Link ${count > 0 ? String(count) : ""}`}
      onSubmit={(addresses) =>
        void command("link.create", { controllerId: controller.id, addresses })
      }
      onClose={onClose}
    />
  );
}

/** Every Address the Controller could drive, Layers under their Scene. */
function collect(
  document: Document,
  controller: Controller & { readonly kind: "number" | "color" },
): PickerCandidate[] {
  const result: (PickerCandidate & { readonly rank: number })[] = [];
  const place = addressPlacer(document);
  for (const resolved of listAddresses(document)) {
    if (!linkable(resolved, controller.kind)) continue;
    const placed = place(resolved);
    if (placed === undefined) continue;
    const existing = linkAt(document, resolved.address);
    const elsewhere =
      existing === undefined || existing.controllerId === controller.id
        ? undefined
        : (document.controllers[existing.controllerId]?.name ?? "another");
    result.push({
      key: resolved.address,
      group: placed.group,
      owner: placed.owner,
      label: resolved.label,
      detail: placed.detail,
      haystack:
        `${placed.group} ${placed.owner} ${placed.detail ?? ""} ${resolved.label}`.toLowerCase(),
      taken: existing?.controllerId === controller.id ? "linked" : undefined,
      note:
        elsewhere === undefined
          ? undefined
          : {
              text: elsewhere,
              title: `Controlled by ${elsewhere}; linking moves it here`,
            },
      rank: placed.rank,
    });
  }
  return result.sort((a, b) => a.rank - b.rank);
}
