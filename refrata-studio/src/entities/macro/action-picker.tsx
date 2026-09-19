import type { DocumentView } from "@refrata/client";
import {
  getAtPath,
  linkAt,
  listAddresses,
  type AddressValue,
  type Document,
  type RunnableMacro,
} from "@refrata/core";
import { useMemo } from "react";

import {
  AddressPicker,
  type PickerCandidate,
} from "@/inspector/fields/address-picker";
import { addressPlacer } from "@/inspector/fields/address-place";
import { useCommand, useSignal } from "@/lib/client";

/**
 * Picks the Addresses a Macro will act on: every one in the Installation
 * under the heading of what owns it. Each pick captures what the Address
 * holds now, so ticking fifteen values writes the state the rig is in; a
 * trigger Address becomes a trigger action.
 */
export function ActionPicker({
  view,
  macro,
  onClose,
}: {
  readonly view: DocumentView;
  readonly macro: RunnableMacro;
  readonly onClose: () => void;
}) {
  const command = useCommand(view);
  const document = useSignal(view.document);
  const candidates = useMemo(
    () => (document === undefined ? [] : collect(document, macro)),
    [document, macro],
  );
  return (
    <AddressPicker
      title={`Add actions to ${macro.name}`}
      testId="action-picker"
      candidates={candidates}
      empty="Nothing to act on in the Installation yet."
      submitLabel={(count) => `Add ${count > 0 ? String(count) : ""}`}
      onSubmit={(addresses) => {
        if (document === undefined) return;
        const actions = addresses
          .map((address) => actionFor(document, address))
          .filter((action) => action !== undefined);
        if (actions.length > 0)
          void command("macro.actions.add", { macroId: macro.id, actions });
      }}
      onClose={onClose}
    />
  );
}

/** A set of the current value, or a trigger, for the Address. */
function actionFor(
  document: Document,
  address: string,
):
  | { readonly kind: "trigger"; readonly address: string }
  | {
      readonly kind: "set";
      readonly address: string;
      readonly value: AddressValue;
    }
  | undefined {
  const resolved = listAddresses(document).find(
    (candidate) => candidate.address === address,
  );
  if (resolved === undefined) return undefined;
  if (resolved.type === "trigger") return { kind: "trigger", address };
  return {
    kind: "set",
    address,
    value: getAtPath(document, resolved.path) as AddressValue,
  };
}

/** Every Address but the Macro's own run, with the words that find it, in the order the picker lists them. */
function collect(document: Document, macro: RunnableMacro): PickerCandidate[] {
  const result: (PickerCandidate & { readonly rank: number })[] = [];
  const place = addressPlacer(document);
  for (const resolved of listAddresses(document)) {
    if (resolved.address === `macro/${macro.id}/run`) continue;
    const placed = place(resolved);
    if (placed === undefined) continue;
    const link = linkAt(document, resolved.address);
    const controller =
      link === undefined ? undefined : document.controllers[link.controllerId];
    result.push({
      key: resolved.address,
      group: placed.group,
      owner: placed.owner,
      label: resolved.label,
      detail: placed.detail,
      haystack:
        `${placed.group} ${placed.owner} ${placed.detail ?? ""} ${resolved.label}`.toLowerCase(),
      note:
        controller === undefined
          ? undefined
          : {
              text: controller.name,
              title: `Controlled by ${controller.name}; a set action is skipped while it is`,
            },
      rank: placed.rank,
    });
  }
  return result.sort((a, b) => a.rank - b.rank);
}
