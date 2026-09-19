import type { DocumentView } from "@refrata/client";
import { normaliseTag } from "@refrata/core";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { NameDialog, type NameRequest } from "@/components/name-dialog";
import { useClient } from "@/lib/client";

/**
 * "Rename…" for a person's Tag: asks for the new text, normalises it and
 * rewrites the Tag on every Fixture, Element and Rule in one undo step.
 * What the command warns about or refuses is a toast.
 */
export function useTagRename(view: DocumentView): {
  readonly rename: (tag: string) => void;
  readonly dialog: ReactNode;
} {
  const client = useClient();
  const { documentId } = view;
  const [naming, setNaming] = useState<NameRequest | undefined>(undefined);
  const rename = (tag: string): void =>
    setNaming({
      title: `Rename Tag ${tag}`,
      label: "Everywhere it is used, Rules included",
      initial: tag,
      submitLabel: "Rename",
      onSubmit: (text) => {
        const to = normaliseTag(text.replaceAll("/", " "));
        if (to === "" || to === tag) return;
        client
          .command<{ readonly warnings?: readonly string[] }>(
            documentId,
            "tag.rename",
            { from: tag, to },
          )
          .then(
            (result) => {
              const warnings = result.warnings ?? [];
              if (warnings.length > 0)
                toast.warning(`Renamed ${tag} to ${to}`, {
                  description: warnings.join("\n"),
                });
            },
            (failure: unknown) => {
              toast.error(`Could not rename ${tag}`, {
                description:
                  failure instanceof Error ? failure.message : String(failure),
              });
            },
          );
      },
    });
  return {
    rename,
    dialog: (
      <NameDialog request={naming} onClose={() => setNaming(undefined)} />
    ),
  };
}
