/**
 * What every Studio window gets as `window.refrataMenu`, from the runtime
 * on this computer or from one elsewhere, and the IPC channels behind it. It
 * is the third bridge, next to `window.refrataDesktop` (local Studio only)
 * and `window.refrataLaunch` (the launch page only), and the only one handed
 * to a page from another machine. That is safe because it gives the page no
 * power over Desktop: the page describes its own menu, which main checks and
 * draws as plain labels, and hears which of its items was clicked.
 *
 * Studio declares the same shape in `refrata-studio/src/menu/menu-bridge.ts`;
 * keep the two in step. A Studio older than this bridge never calls it and
 * keeps its in-page bar, which still works.
 */
export interface RefrataMenu {
  /** Replaces the page's part of the native menu. Checked by `parsePageMenu`. */
  setMenu(model: unknown): void;
  /** Calls back with the `id` of a native menu item that was clicked. Returns the unsubscribe. */
  onMenuCommand(callback: (id: string) => void): () => void;
  /**
   * Calls back now and on every change with whether the window is full
   * screen. Windows and Linux hide the native menu bar there, so Studio shows
   * its in-page bar meanwhile. Returns the unsubscribe.
   */
  onFullScreenChange(callback: (fullScreen: boolean) => void): () => void;
}

export const menuChannels = {
  setMenu: "refrata-menu:set-menu",
  menuCommand: "refrata-menu:menu-command",
  fullScreen: "refrata-menu:full-screen",
} as const;
