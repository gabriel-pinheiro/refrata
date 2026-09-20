/**
 * What the preload script exposes to Studio as `window.refrataDesktop`, and
 * the IPC channels behind it. The bridge is the only thing a page can reach in
 * Desktop, so it carries only what needs the operating system: native file
 * pickers, and files the OS asks the app to open. Everything else Studio does
 * goes to the runtime, where the CLI can do it too; whatever a page can call
 * in main is attack surface, and what a picker returns is only a path for a
 * request the CLI can send as well.
 *
 * Studio declares the same shape in
 * `refrata-studio/src/documents/desktop-bridge.ts`; keep the two in step.
 */
export interface RefrataDesktop {
  /** A native Open dialog; the absolute path picked, or null when cancelled. */
  pickOpenPath(): Promise<string | null>;
  /** A native Save dialog, its file name filled in with `<suggestedName>.refrata`. */
  pickSavePath(suggestedName?: string): Promise<string | null>;
  /**
   * Calls back with a file the OS asked Desktop to open while it was already
   * running (a double click, a second launch). Returns the unsubscribe.
   */
  onOpenRequest(callback: (path: string) => void): () => void;
}

export const channels = {
  pickOpenPath: "refrata:pick-open-path",
  pickSavePath: "refrata:pick-save-path",
  openRequest: "refrata:open-request",
} as const;

/** How main tells a Studio window's preload which origin may have its bridges (see `menu-expose.ts`). */
export const BRIDGE_ORIGIN_ARGUMENT = "--refrata-bridge-origin=";
