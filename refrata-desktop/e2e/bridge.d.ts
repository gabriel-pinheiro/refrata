import type { RefrataDesktop } from "../src/bridge-contract.ts";
import type { RefrataLaunch } from "../src/launch-contract.ts";
import type { RefrataMenu } from "../src/menu-contract.ts";

declare global {
  interface Window {
    readonly refrataDesktop?: RefrataDesktop;
    readonly refrataLaunch?: RefrataLaunch;
    readonly refrataMenu?: RefrataMenu;
  }
}
