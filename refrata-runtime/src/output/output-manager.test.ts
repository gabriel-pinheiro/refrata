import { describe, expect, it } from "vitest";

import { createDrivers } from "./drivers.ts";
import { OutputManager } from "./output-manager.ts";
import { fakeSerialFactory, FTDI_PORT } from "./serial/fake-serial.ts";

const frame = (): Uint8Array => {
  const bytes = new Uint8Array(512);
  bytes[0] = 255;
  bytes[9] = 128;
  return bytes;
};

describe("OutputManager", () => {
  it("opens a link per Output, reports status, sends frames and survives an unplug", async () => {
    let now = 0;
    const fake = fakeSerialFactory([FTDI_PORT]);
    const manager = new OutputManager({
      drivers: createDrivers({ serial: () => Promise.resolve(fake.factory) }),
      log: () => undefined,
      retryMs: 0,
      now: () => now,
    });
    await manager.sync({
      o1: {
        id: "o1" as never,
        universeId: "u",
        kind: "enttec-usb-pro",
        device: "any",
      },
      o2: {
        id: "o2" as never,
        universeId: "u",
        kind: "enttec-open-dmx",
        device: "missing",
      },
    });
    expect(manager.statuses()).toMatchObject({
      o1: { state: "delivering", path: "/dev/ttyUSB0" },
      o2: { state: "device-missing" },
    });
    manager.send(new Map([["u", frame()]]));
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(fake.links[0]?.log).toHaveLength(1);
    now = 1_500;
    manager.send(new Map([["u", frame()]]));
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(manager.statuses().o1?.fps).toBeGreaterThan(0);
    fake.links[0]?.vanish();
    expect(manager.statuses().o1?.state).toBe("device-missing");
    now = 3_000;
    manager.send(new Map([["u", frame()]]));
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(manager.statuses().o1?.state).toBe("delivering");
    expect(fake.links).toHaveLength(2);
    await manager.sync({});
    expect(manager.statuses()).toEqual({});
    expect(fake.links[1]?.closed).toBe(true);
  });

  it("lets go of a widget whose sends fail without a close and finds it again on its new path", async () => {
    let now = 0;
    const fake = fakeSerialFactory([FTDI_PORT]);
    const manager = new OutputManager({
      drivers: createDrivers({ serial: () => Promise.resolve(fake.factory) }),
      log: () => undefined,
      retryMs: 1_000,
      now: () => now,
    });
    const settle = (): Promise<void> =>
      new Promise((resolve) => setTimeout(resolve, 5));
    await manager.sync({
      o1: {
        id: "o1" as never,
        universeId: "u",
        kind: "enttec-open-dmx",
        device: "any",
      },
    });
    fake.links[0]?.fail(new Error("Input/output error, cannot set"));
    fake.ports = [];
    manager.send(new Map([["u", frame()]]));
    await settle();
    expect(manager.statuses().o1).toMatchObject({
      state: "error",
      message: "Input/output error, cannot set",
    });
    expect(fake.links[0]?.closed).toBe(true);
    now = 1_000;
    manager.send(new Map([["u", frame()]]));
    await settle();
    expect(manager.statuses().o1?.state).toBe("device-missing");
    fake.ports = [{ ...FTDI_PORT, path: "/dev/ttyUSB1" }];
    manager.send(new Map([["u", frame()]]));
    await settle();
    expect(manager.statuses().o1?.state).toBe("device-missing");
    now = 2_000;
    manager.send(new Map([["u", frame()]]));
    await settle();
    expect(manager.statuses().o1).toMatchObject({
      state: "delivering",
      path: "/dev/ttyUSB1",
    });
    expect(fake.links).toHaveLength(2);
  });

  it("lets go of a widget whose send hangs and opens it again", async () => {
    const fake = fakeSerialFactory([FTDI_PORT]);
    const manager = new OutputManager({
      drivers: createDrivers({ serial: () => Promise.resolve(fake.factory) }),
      log: () => undefined,
      retryMs: 0,
      sendTimeoutMs: 10,
    });
    await manager.sync({
      o1: {
        id: "o1" as never,
        universeId: "u",
        kind: "enttec-open-dmx",
        device: "any",
      },
    });
    fake.links[0]?.hang();
    manager.send(new Map([["u", frame()]]));
    await new Promise((resolve) => setTimeout(resolve, 5));
    manager.send(new Map([["u", frame()]]));
    expect(fake.links).toHaveLength(1);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(manager.statuses().o1).toMatchObject({
      state: "error",
      message: "The device took longer than 10 ms to take a frame.",
    });
    expect(fake.links[0]?.closed).toBe(true);
    manager.send(new Map([["u", frame()]]));
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(manager.statuses().o1?.state).toBe("delivering");
    manager.send(new Map([["u", frame()]]));
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(fake.links).toHaveLength(2);
    expect(fake.links[1]?.log.length).toBeGreaterThan(0);
  });
});
