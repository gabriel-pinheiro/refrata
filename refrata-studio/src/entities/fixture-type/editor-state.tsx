import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export const EDITOR_SECTIONS = [
  "channels",
  "elements",
  "parameters",
  "actions",
] as const;
export type EditorSection = (typeof EDITOR_SECTIONS)[number];

interface EditorState {
  /** The type the Fixture Editor is open on; the first one held until a person picks. */
  readonly typeKey: string | undefined;
  /** The Mode open in it; the type's first until a person picks. */
  readonly modeKey: string | undefined;
  readonly section: EditorSection;
  /** The Fixture the probe is aimed at, held or not. */
  readonly probeFixtureId: string | undefined;
  readonly openType: (typeKey: string, modeKey?: string) => void;
  readonly openMode: (modeKey: string) => void;
  readonly openSection: (section: EditorSection) => void;
  readonly aimProbe: (fixtureId: string | undefined) => void;
}

const Context = createContext<EditorState | undefined>(undefined);

/**
 * Where the Fixture Editor stands: the type and Mode it is open on, the
 * list it shows and the Fixture its probe is aimed at. Studio-local and
 * held above the centre tabs, so the inspector reads the same probe and a
 * Fixture's inspector can open its type there.
 */
export function FixtureEditorProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const [open, setOpen] = useState<{
    readonly typeKey: string | undefined;
    readonly modeKey: string | undefined;
  }>({ typeKey: undefined, modeKey: undefined });
  const [section, openSection] = useState<EditorSection>("channels");
  const [probeFixtureId, aimProbe] = useState<string | undefined>(undefined);
  const openType = useCallback(
    (typeKey: string, modeKey?: string) => setOpen({ typeKey, modeKey }),
    [],
  );
  const openMode = useCallback(
    (modeKey: string) => setOpen((previous) => ({ ...previous, modeKey })),
    [],
  );
  const state = useMemo(
    () => ({
      ...open,
      section,
      probeFixtureId,
      openType,
      openMode,
      openSection,
      aimProbe,
    }),
    [open, section, probeFixtureId, openType, openMode],
  );
  return <Context.Provider value={state}>{children}</Context.Provider>;
}

export function useFixtureEditor(): EditorState {
  const state = useContext(Context);
  if (state === undefined)
    throw new Error("useFixtureEditor needs a FixtureEditorProvider.");
  return state;
}
