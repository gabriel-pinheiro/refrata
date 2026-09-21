import type { LiveState } from "@refrata/protocol";

/** Why a local session is being left, which the warning's wording follows. */
export type Leaving = "quit" | "switch";

/**
 * How many Outputs are delivering right now, from the runtime's live state:
 * those whose Output Status says a device is open and taking DMX Frames. They
 * stop with the runtime, so the rig goes dark or holds its last frame. An
 * Output whose device is missing or failing sends nothing, so leaving takes
 * nothing away from it.
 */
export function countDeliveringOutputs(live: LiveState): number {
  return Object.values(live.outputs).filter(
    (status) => status.state === "delivering",
  ).length;
}

/**
 * The count Desktop's own tests ask for in `REFRATA_TEST_DELIVERING_OUTPUTS`:
 * an Output only delivers through a DMX widget, which a test run has none of
 * and must never open, so the e2e suite says how many to take as delivering.
 * Only a checkout listens; a packaged Desktop counts what its runtime reports,
 * whatever the environment says.
 */
export function deliveringOutputsForTests(
  env: Readonly<Record<string, string | undefined>>,
  packaged: boolean,
): number | undefined {
  const asked = env.REFRATA_TEST_DELIVERING_OUTPUTS;
  if (packaged || asked === undefined) return undefined;
  const count = Number(asked);
  return Number.isInteger(count) && count >= 0 ? count : undefined;
}

/** The words of the warning shown before a runtime with delivering Outputs is stopped. */
export function outputsWarning(
  count: number,
  leaving: Leaving,
): {
  readonly message: string;
  readonly detail: string;
  readonly confirm: string;
} {
  const delivering =
    count === 1
      ? "1 Output is delivering DMX from this computer."
      : `${String(count)} Outputs are delivering DMX from this computer.`;
  const them = count === 1 ? "it" : "them";
  return {
    message: delivering,
    detail:
      leaving === "quit"
        ? `Quitting stops ${them}.`
        : `Switching stops ${them}.`,
    confirm: leaving === "quit" ? "Quit" : "Switch",
  };
}
