import type { RefrataDesktop } from "../src/bridge-contract.ts";

declare global {
  interface Window {
    readonly refrataDesktop?: RefrataDesktop;
  }
}
