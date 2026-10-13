import type { DocumentView } from "@refrata/client";
import type { FixtureType } from "@refrata/core";
import type { CommandResult } from "@refrata/protocol";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useClient } from "@/lib/client";
import { useSelection } from "@/selection/selection";

import { useFixtureEditor } from "./editor-state";
import { useTypeCommand } from "./scope";
import {
  downloadFixtureType,
  pickFixtureFile,
  readFixtureFile,
} from "./type-transfer";

const say = (failure: unknown): string =>
  failure instanceof Error ? failure.message : String(failure);

/** Opens the type a command made in the editor and picks it, so the inspector shows it. */
function useOpenMade(): (
  result: CommandResult | undefined,
  fallback?: string,
) => void {
  const { openType } = useFixtureEditor();
  const { select } = useSelection();
  return useCallback(
    (result, fallback) => {
      if (result === undefined) return;
      const key =
        result.created?.find((entity) => entity.table === "fixtureTypes")?.id ??
        fallback;
      if (key === undefined) return;
      openType(key);
      select({ kind: "fixtureType", id: key });
    },
    [openType, select],
  );
}

/** What can be done with whole Fixture Types: export, duplicate, import from the library, and take the library's definition. */
export function useTypeActions(view: DocumentView): {
  readonly exportType: (type: FixtureType) => void;
  readonly duplicate: (typeKey: string) => void;
  readonly importLibrary: (key: string) => void;
  /** One `fixture.reload`, so one undo step however many types it takes. */
  readonly takeLibrary: (keys: readonly string[], what: string) => void;
} {
  const client = useClient();
  const command = useTypeCommand(view);
  const openMade = useOpenMade();
  const { documentId } = view;
  return useMemo(() => {
    const libraryType = (key: string): Promise<FixtureType> =>
      client
        .request<{ type: FixtureType }>("library.get", { key })
        .then((reply) => reply.type);
    return {
      exportType: downloadFixtureType,
      duplicate: (typeKey) =>
        void command("type.duplicate", { typeKey }).then(openMade),
      importLibrary: (key) =>
        void libraryType(key).then(
          (fixtureType) =>
            command("type.import", {
              fixtureType,
              origin: { from: "library" },
            }).then(openMade),
          (failure: unknown) => toast.error(say(failure)),
        ),
      takeLibrary: (keys, what) =>
        void Promise.all(keys.map(libraryType))
          .then((types) =>
            client.command<CommandResult>(documentId, "fixture.reload", {
              types,
            }),
          )
          .then(
            (result) => {
              const warnings = result.warnings ?? [];
              if (warnings.length > 0)
                toast.warning(`Took the library's ${what}`, {
                  description: warnings.join("\n"),
                });
            },
            (failure: unknown) => {
              toast.error(`Could not take the library's ${what}`, {
                description: say(failure),
              });
            },
          ),
    };
  }, [client, command, openMade, documentId]);
}

/**
 * Imports a `.refrata-fixture` file picked on this machine. When the
 * Installation already has the type's key, a dialog asks whether to
 * replace it or keep both.
 */
export function useImportFile(
  view: DocumentView,
): readonly [importFile: () => void, dialog: ReactNode] {
  const command = useTypeCommand(view);
  const openMade = useOpenMade();
  const [held, setHeld] = useState<
    { readonly type: FixtureType; readonly file: string } | undefined
  >(undefined);
  const send = (
    fixtureType: FixtureType,
    file: string,
    onHeld?: "replace" | "copy",
  ): void =>
    void command("type.import", {
      fixtureType,
      origin: { from: "file", file },
      ...(onHeld === undefined ? {} : { onHeld }),
    }).then((result) => openMade(result, fixtureType.key));
  const importFile = (): void =>
    void pickFixtureFile().then(async (file) => {
      if (file === undefined) return;
      const type = await readFixtureFile(file);
      if ("error" in type) toast.error(type.error);
      else if (type.key in (view.get()?.fixtureTypes ?? {}))
        setHeld({ type, file: file.name });
      else send(type, file.name);
    });
  const dialog = (
    <AlertDialog
      open={held !== undefined}
      onOpenChange={(open) => {
        if (!open) setHeld(undefined);
      }}
    >
      {held !== undefined && (
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              The Installation already has {held.type.manufacturer}{" "}
              {held.type.model}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Replace it with the one in {held.file}, which changes every
              Fixture of it, or keep both, the file's under a new key.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="outline"
              onClick={() => {
                setHeld(undefined);
                send(held.type, held.file, "copy");
              }}
            >
              Keep both
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => {
                setHeld(undefined);
                send(held.type, held.file, "replace");
              }}
            >
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}
    </AlertDialog>
  );
  return [importFile, dialog];
}
