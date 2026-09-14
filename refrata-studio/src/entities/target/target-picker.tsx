import type { DocumentView } from "@refrata/client";
import {
  allFixtures,
  allSets,
  elementRef,
  fixtureElements,
  setRef,
  type Document,
} from "@refrata/core";
import { useMemo } from "react";

import {
  AddressPicker,
  type PickerCandidate,
} from "@/inspector/fields/address-picker";
import { useSignal } from "@/lib/client";

/**
 * Picks Elements (and, for a Layer, Fixture Sets) out of the whole rig:
 * every Fixture with its Elements under it, searched by Fixture name,
 * Element name and Tags, so "panel" lists every panel. What is already a
 * Target or a member shows ticked and disabled; the children of a targeted
 * root stay available, since adding one is how a Target overrides its
 * root's rows.
 */
export function TargetPicker({
  view,
  title,
  members,
  taken,
  submitLabel,
  onSubmit,
  onClose,
}: {
  readonly view: DocumentView;
  readonly title: string;
  /** Set members: Elements only, no Fixture Sets on offer. */
  readonly members: boolean;
  readonly taken: readonly string[];
  readonly submitLabel: (count: number) => string;
  readonly onSubmit: (refs: readonly string[]) => void;
  readonly onClose: () => void;
}) {
  const document = useSignal(view.document);
  const candidates = useMemo(
    () =>
      document === undefined ? [] : collect(document, members, new Set(taken)),
    [document, members, taken],
  );
  return (
    <AddressPicker
      title={title}
      testId="target-picker"
      candidates={candidates}
      placeholder="Fixture, Element or tag…"
      empty="No Fixtures in the rig yet."
      submitLabel={submitLabel}
      onSubmit={onSubmit}
      onClose={onClose}
    />
  );
}

function collect(
  document: Document,
  members: boolean,
  taken: ReadonlySet<string>,
): PickerCandidate[] {
  const word = members ? "member" : "targeted";
  const result: PickerCandidate[] = [];
  for (const fixture of allFixtures(document.fixtures)) {
    const elements = fixtureElements(document, fixture);
    for (const element of elements) {
      const ref = elementRef(fixture.id, element.key);
      const root = element.parentKey === null;
      result.push({
        key: ref,
        group: "Fixtures",
        owner: root ? "" : fixture.name,
        label: root ? fixture.name : element.name,
        detail: root ? undefined : element.tags.join(" "),
        haystack:
          `${fixture.name} ${element.name} ${element.tags.join(" ")}`.toLowerCase(),
        taken: taken.has(ref) ? word : undefined,
      });
    }
  }
  if (!members)
    for (const set of allSets(document.fixtureSets)) {
      const ref = setRef(set.id);
      result.push({
        key: ref,
        group: "Fixture Sets",
        owner: "",
        label: set.name,
        detail: `${String(set.members.length)} ${set.members.length === 1 ? "member" : "members"}`,
        haystack: `set ${set.name}`.toLowerCase(),
        taken: taken.has(ref) ? word : undefined,
      });
    }
  return result;
}
