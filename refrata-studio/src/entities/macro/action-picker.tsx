import type { DocumentView } from "@refrata/client";
import {
  getAtPath,
  linkAt,
  listAddresses,
  type AddressValue,
  type Document,
  type ResolvedAddress,
  type RunnableMacro,
} from "@refrata/core";
import { useMemo } from "react";

import {
  AddressPicker,
  type PickerCandidate,
} from "@/inspector/fields/address-picker";
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

const HEADING_RANK: Record<string, number> = {
  Installation: 0,
  Controllers: 1,
  Macros: 2,
};

/** Every Address, with the words that find it, in the order the picker lists them. */
function collect(document: Document, macro: RunnableMacro): PickerCandidate[] {
  const result: (PickerCandidate & { readonly rank: number })[] = [];
  for (const resolved of listAddresses(document)) {
    const placed = place(resolved, macro);
    if (placed === undefined) continue;
    const link = linkAt(document, resolved.address);
    const controller =
      link === undefined ? undefined : document.controllers[link.controllerId];
    result.push({
      key: resolved.address,
      group: placed.group,
      owner: placed.owner,
      label: resolved.label,
      haystack:
        `${placed.group} ${placed.owner} ${resolved.label}`.toLowerCase(),
      note:
        controller === undefined
          ? undefined
          : {
              text: controller.name,
              title: `Controlled by ${controller.name}; a set action is skipped while it is`,
            },
      rank: HEADING_RANK[placed.group] ?? 9,
    });
  }
  return result.sort((a, b) => a.rank - b.rank);
}

function place(
  resolved: ResolvedAddress,
  macro: RunnableMacro,
): { readonly group: string; readonly owner: string } | undefined {
  const [kind, id = ""] = resolved.address.split("/");
  switch (kind) {
    case "installation":
      return { group: "Installation", owner: "" };
    case "controller":
      return { group: "Controllers", owner: resolved.owner ?? "" };
    case "macro":
      return id === macro.id
        ? undefined
        : { group: "Macros", owner: resolved.owner ?? "" };
    default:
      return undefined;
  }
}
