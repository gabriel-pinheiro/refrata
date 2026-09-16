import { describe, expect, it } from "vitest";

import { createDrivers } from "../drivers.ts";
import { DeviceMissingError } from "../output-driver.ts";
import { OutputManager } from "../output-manager.ts";
import { fakeUsbFactory, UDMX_DEVICE } from "./fake-usb.ts";
import { changedRange, pickUdmx } from "./udmx.ts";

const settle = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 5));

describe("pickUdmx", () => {
  const other = { ...UDMX_DEVICE, location: "1-1", productName: "Blinkstick" };
  const second = { ...UDMX_DEVICE, location: "3-2" };

  it("takes the first uDMX for any, ignoring other devices on the shared ids", () => {
    expect(pickUdmx([other, UDMX_DEVICE, second], "any").location).toBe("3-2");
    expect(() => pickUdmx([other], "any")).toThrow(DeviceMissingError);
  });

  it("matches a port location or a serial number only one device carries", () => {
    expect(pickUdmx([UDMX_DEVICE, second], "3-4").location).toBe("3-4");
    const unique = { ...second, serialNumber: "B2" };
    expect(pickUdmx([UDMX_DEVICE, unique], "B2").location).toBe("3-2");
    expect(() => pickUdmx([UDMX_DEVICE], "nope")).toThrow(DeviceMissingError);
  });

  it("refuses a serial number several clones share, naming their locations", () => {
    expect(() => pickUdmx([UDMX_DEVICE, second], "ilLUTZminator001")).toThrow(
      "2 uDMX devices share serial number ilLUTZminator001; name one by port location: 3-2, 3-4.",
    );
  });
});

describe("changedRange", () => {
  const frame = (changes: Record<number, number> = {}): Uint8Array => {
    const bytes = new Uint8Array(512);
    for (const [slot, value] of Object.entries(changes))
      bytes[Number(slot)] = value;
    return bytes;
  };

  it("spans the whole frame when nothing is known, and nothing when nothing changed", () => {
    expect(changedRange(undefined, frame())).toEqual([0, 512]);
    expect(changedRange(frame({ 3: 1 }), frame({ 3: 1 }))).toBeUndefined();
  });

  it("spans from the first to the last changed slot", () => {
    expect(changedRange(frame(), frame({ 9: 1, 19: 2 }))).toEqual([9, 20]);
    expect(changedRange(frame(), frame({ 511: 1 }))).toEqual([511, 512]);
    expect(changedRange(frame({ 0: 5 }), frame())).toEqual([0, 1]);
  });
});

describe("uDMX Output", () => {
  it("sends the first frame whole, then only what changed, and nothing for a frame that changed nothing", async () => {
    let now = 0;
    const fake = fakeUsbFactory([UDMX_DEVICE]);
    const manager = new OutputManager({
      drivers: createDrivers({ usb: () => Promise.resolve(fake.factory) }),
      log: () => undefined,
      retryMs: 1_000,
      now: () => now,
    });
    await manager.sync({
      o1: {
        id: "o1" as never,
        universeId: "u",
        kind: "anyma-udmx",
        device: "any",
      },
    });
    expect(manager.statuses().o1).toMatchObject({
      state: "delivering",
      path: "3-4",
    });
    const frame = new Uint8Array(512);
    frame[0] = 40;
    manager.send(new Map([["u", frame]]));
    await settle();
    manager.send(new Map([["u", frame]]));
    await settle();
    frame[9] = 128;
    frame[19] = 255;
    manager.send(new Map([["u", frame]]));
    await settle();
    const handle = fake.handles[0];
    expect(
      handle?.transfers.map(({ request, value, index }) => ({
        request,
        value,
        index,
      })),
    ).toEqual([
      { request: 2, value: 512, index: 0 },
      { request: 2, value: 11, index: 9 },
    ]);
    expect([...(handle?.transfers[1]?.data ?? [])]).toEqual([
      128, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255,
    ]);
    now = 1_000;
    manager.send(new Map([["u", frame]]));
    expect(manager.statuses().o1?.fps).toBe(3);

    handle?.vanish(new Error("The device went away."));
    expect(manager.statuses().o1).toMatchObject({
      state: "device-missing",
      message: "The device went away.",
    });
    now = 2_000;
    manager.send(new Map([["u", frame]]));
    await settle();
    manager.send(new Map([["u", frame]]));
    await settle();
    expect(fake.handles).toHaveLength(2);
    expect(fake.handles[1]?.transfers).toMatchObject([
      { value: 512, index: 0 },
    ]);
  });

  it("reports a missing uDMX as device missing", async () => {
    const manager = new OutputManager({
      drivers: createDrivers({
        usb: () => Promise.resolve(fakeUsbFactory([]).factory),
      }),
      log: () => undefined,
    });
    await manager.sync({
      o1: {
        id: "o1" as never,
        universeId: "u",
        kind: "anyma-udmx",
        device: "any",
      },
    });
    expect(manager.statuses().o1).toMatchObject({
      state: "device-missing",
      message: "No uDMX found.",
    });
  });
});
