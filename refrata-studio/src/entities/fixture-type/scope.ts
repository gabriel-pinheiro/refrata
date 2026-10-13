import type { DocumentView } from "@refrata/client";
import {
  channelRows,
  type ChannelRow,
  type FixtureType,
  type Mode,
  type StoredFixtureType,
} from "@refrata/core";
import type { CommandResult } from "@refrata/protocol";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";

import { showWarnings, useClient, useDocumentPath } from "@/lib/client";
import { pickModeOf, soleSelection, useSelection } from "@/selection/selection";

import { parsePick, pickSelection, type Pick } from "./type-ref";

/** Sends a command; resolves to its reply, or undefined after saying why it was refused. */
export type RunCommand = (
  name: string,
  payload?: object,
) => Promise<CommandResult | undefined>;

/** A command against `view`'s document whose refusal is a toast and whose reply is returned, for what the command created. */
export function useTypeCommand(view: DocumentView): RunCommand {
  const client = useClient();
  const { documentId } = view;
  return useCallback(
    (name, payload = {}) =>
      client.command<CommandResult>(documentId, name, payload).then(
        (result) => {
          showWarnings(result.warnings ?? []);
          return result;
        },
        (failure: unknown) => {
          toast.error(
            failure instanceof Error ? failure.message : String(failure),
          );
          return undefined;
        },
      ),
    [client, documentId],
  );
}

/** One Mode of one type as the editor works on it: what it holds, how to change it and how to move between its parts. */
export interface Scope {
  readonly view: DocumentView;
  readonly typeKey: string;
  readonly modeKey: string;
  readonly stored: StoredFixtureType;
  readonly type: FixtureType;
  readonly mode: Mode;
  /** The Mode as a chart, in wire order. */
  readonly rows: readonly ChannelRow[];
  /** What the selection holds, when it is one thing of this Mode. */
  readonly pick: Pick | undefined;
  /** Runs a `type.*` command on this type. */
  readonly runType: RunCommand;
  /** Runs a `type.*` command on this Mode. */
  readonly run: RunCommand;
  /** Selects a part of this Mode, so the inspector edits it. */
  readonly open: (
    pick: Pick | undefined,
    event?: Parameters<typeof pickModeOf>[0],
  ) => void;
}

/** The scope of a type's Mode, read from the document; undefined while the Installation lacks either. */
export function useScope(
  view: DocumentView,
  typeKey: string,
  modeKey: string,
): Scope | undefined {
  const command = useTypeCommand(view);
  const { selected, select } = useSelection();
  const stored = useDocumentPath<StoredFixtureType>(view, [
    "fixtureTypes",
    typeKey,
  ]);
  const mode = stored?.type.modes[modeKey];
  const rows = useMemo(
    () => (mode === undefined ? [] : channelRows(mode)),
    [mode],
  );
  const only = soleSelection(selected);
  const held =
    only === undefined || only.kind === "installation"
      ? undefined
      : parsePick(only.kind, only.id);
  const pick =
    held?.typeKey === typeKey &&
    (held.modeKey === undefined || held.modeKey === modeKey)
      ? held.pick
      : undefined;
  const runType = useCallback<RunCommand>(
    (name, payload = {}) => command(name, { typeKey, ...payload }),
    [command, typeKey],
  );
  const run = useCallback<RunCommand>(
    (name, payload = {}) => command(name, { typeKey, modeKey, ...payload }),
    [command, typeKey, modeKey],
  );
  const open = useCallback<Scope["open"]>(
    (next, event) =>
      select(
        next === undefined ? undefined : pickSelection(typeKey, modeKey, next),
        pickModeOf(event),
      ),
    [select, typeKey, modeKey],
  );
  if (stored === undefined || mode === undefined) return undefined;
  return {
    view,
    typeKey,
    modeKey,
    stored,
    type: stored.type,
    mode,
    rows,
    pick,
    runType,
    run,
    open,
  };
}
