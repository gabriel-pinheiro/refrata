import { describe, expect, it } from "vitest";

import {
  missingWidgetMessage,
  openDmxFraming,
  usbProPacket,
} from "./enttec.ts";
import { fakeSerialFactory, FTDI_PORT } from "./fake-serial.ts";
import { pickPort } from "./serial-port.ts";

const frame = (): Uint8Array => {
  const bytes = new Uint8Array(512);
  bytes[0] = 255;
  bytes[9] = 128;
  return bytes;
};

describe("Enttec framing", () => {
  it("frames a DMX USB Pro packet", () => {
    const packet = usbProPacket(frame());
    expect([...packet.slice(0, 5)]).toEqual([0x7e, 6, 0x01, 0x02, 0]);
    expect(packet[5]).toBe(255);
    expect(packet[14]).toBe(128);
    expect(packet.at(-1)).toBe(0xe7);
    expect(packet).toHaveLength(518);
  });

  it("raises the break, releases it and streams a start code plus 512 slots on Open DMX", async () => {
    const fake = fakeSerialFactory([FTDI_PORT]);
    const link = await fake.factory.open(
      "/dev/ttyUSB0",
      openDmxFraming.options,
    );
    await openDmxFraming.send(link, frame());
    const [first, second, third] = fake.links[0]?.log ?? [];
    expect(first).toBe("break on");
    expect(second).toBe("break off");
    expect(third).toBeInstanceOf(Uint8Array);
    expect([...(third as Uint8Array).slice(0, 2)]).toEqual([0, 255]);
    expect(third).toHaveLength(513);
    expect(openDmxFraming.options).toMatchObject({
      baudRate: 250_000,
      stopBits: 2,
    });
  });
});

describe("pickPort", () => {
  it("prefers the FTDI widget for any and matches serial numbers", () => {
    const other = {
      ...FTDI_PORT,
      path: "/dev/ttyACM0",
      vendorId: "2341",
      serialNumber: "X",
    };
    expect(pickPort([other, FTDI_PORT], "any")?.path).toBe("/dev/ttyUSB0");
    expect(pickPort([other], "any")).toBeUndefined();
    expect(pickPort([other, FTDI_PORT], "A1B2C3")?.path).toBe("/dev/ttyUSB0");
    expect(pickPort([other, FTDI_PORT], "/dev/ttyACM0")?.path).toBe(
      "/dev/ttyACM0",
    );
    expect(pickPort([other, FTDI_PORT], "nope")).toBeUndefined();
  });
});

describe("missingWidgetMessage", () => {
  it("calls a path a path and anything else a serial number", () => {
    expect(missingWidgetMessage("any")).toBe("No serial DMX widget found.");
    expect(missingWidgetMessage("/dev/ttyUSB0")).toBe(
      "No widget at path /dev/ttyUSB0.",
    );
    expect(missingWidgetMessage("COM3")).toBe("No widget at path COM3.");
    expect(missingWidgetMessage("A1B2C3")).toBe(
      "No widget with serial number A1B2C3.",
    );
  });
});
