import type { DocumentView } from "@refrata/client";
import type { LibraryEntry } from "@refrata/protocol";
import { Download, FileUp, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";

import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useFixtureEditor } from "@/entities/fixture-type/editor-state";
import { useTypeCommand } from "@/entities/fixture-type/scope";
import {
  useImportFile,
  useTypeActions,
} from "@/entities/fixture-type/use-type-actions";
import { useLibrary } from "@/entities/fixture/use-library";
import { useSelection } from "@/selection/selection";

import { NewTypeDialog } from "./new-type-dialog";

/** The ways to bring a type in, and the library's types the Installation lacks. */
export interface BringIn {
  readonly newType: () => void;
  readonly importFile: () => void;
  readonly importLibrary: (key: string) => void;
  readonly library: readonly LibraryEntry[];
}

/** One set of the ways to bring a type in, with the dialogs they open, shared by the rail and the menu. */
export function useBringIn(
  view: DocumentView,
  held: readonly string[],
): readonly [bringIn: BringIn, dialogs: ReactNode] {
  const command = useTypeCommand(view);
  const actions = useTypeActions(view);
  const { openType } = useFixtureEditor();
  const { select } = useSelection();
  const [importFile, importDialog] = useImportFile(view);
  const [creating, setCreating] = useState(false);
  const { entries } = useLibrary(held.join(" "));
  const bringIn: BringIn = {
    newType: () => setCreating(true),
    importFile,
    importLibrary: actions.importLibrary,
    library: (entries ?? []).filter((entry) => !held.includes(entry.key)),
  };
  return [
    bringIn,
    <span className="contents">
      {importDialog}
      <NewTypeDialog
        open={creating}
        onClose={() => setCreating(false)}
        onSubmit={(made) =>
          void command("type.create", made).then((result) => {
            const key = result?.created?.find(
              (entity) => entity.table === "fixtureTypes",
            )?.id;
            if (key === undefined) return;
            openType(key);
            select({ kind: "fixtureType", id: key });
          })
        }
      />
    </span>,
  ];
}

/** What bringing a type in offers: a blank one, a file, the library's types the Installation lacks. */
export function BringInItems({ bringIn }: { readonly bringIn: BringIn }) {
  return (
    <>
      <DropdownMenuItem onClick={bringIn.newType}>
        <Plus /> New Fixture Type
      </DropdownMenuItem>
      <DropdownMenuItem onClick={bringIn.importFile}>
        <FileUp /> Import a .refrata-fixture file
      </DropdownMenuItem>
      {bringIn.library.length > 0 && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>Import from Refrata's library</DropdownMenuLabel>
            {bringIn.library.map((entry) => (
              <DropdownMenuItem
                key={entry.key}
                onClick={() => bringIn.importLibrary(entry.key)}
              >
                <Download /> {entry.manufacturer} {entry.model}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </>
      )}
    </>
  );
}
