import {
  EMPTY_LIVE_STATE,
  type LiveState,
  type OutputState,
} from "@refrata/protocol";
import { describe, expect, it } from "vitest";

import {
  countDeliveringOutputs,
  deliveringOutputsForTests,
  outputsWarning,
} from "./delivering-outputs.ts";

function live(states: Readonly<Record<string, OutputState>>): LiveState {
  return {
    ...EMPTY_LIVE_STATE,
    outputs: Object.fromEntries(
      Object.entries(states).map(([id, state]) => [
        id,
        state === "delivering"
          ? { state, path: "/dev/ttyUSB0", fps: 40 }
          : { state, path: null, fps: 0, message: "No widget." },
      ]),
    ),
  };
}

describe("Outputs delivering from the runtime", () => {
  it("counts every Output that is delivering", () => {
    expect(countDeliveringOutputs(live({}))).toBe(0);
    expect(
      countDeliveringOutputs(
        live({ truss: "delivering", floor: "delivering" }),
      ),
    ).toBe(2);
  });

  it("leaves out the ones whose device is missing or failing, which send nothing", () => {
    expect(
      countDeliveringOutputs(
        live({ truss: "delivering", floor: "device-missing", back: "error" }),
      ),
    ).toBe(1);
  });

  it("takes a count from the environment in a checkout only", () => {
    const env = { REFRATA_TEST_DELIVERING_OUTPUTS: "2" };
    expect(deliveringOutputsForTests(env, false)).toBe(2);
    expect(deliveringOutputsForTests(env, true)).toBeUndefined();
    expect(deliveringOutputsForTests({}, false)).toBeUndefined();
    expect(
      deliveringOutputsForTests(
        { REFRATA_TEST_DELIVERING_OUTPUTS: "many" },
        false,
      ),
    ).toBeUndefined();
  });

  it("words the warning for one and for many, for quitting and for switching", () => {
    expect(outputsWarning(1, "quit")).toEqual({
      message: "1 Output is delivering DMX from this computer.",
      detail: "Quitting stops it.",
      confirm: "Quit",
    });
    expect(outputsWarning(2, "switch")).toEqual({
      message: "2 Outputs are delivering DMX from this computer.",
      detail: "Switching stops them.",
      confirm: "Switch",
    });
  });
});
