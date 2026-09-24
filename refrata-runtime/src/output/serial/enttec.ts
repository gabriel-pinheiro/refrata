import { ANY_DEVICE, settings } from "@refrata/core";

import { DeviceMissingError, type OutputDriver } from "../output-driver.ts";
import {
  pickPort,
  type SerialLink,
  type SerialOptions,
  type SerialPortFactory,
} from "./serial-port.ts";

/**
 * How an Enttec widget family takes a DMX Frame. An Open DMX widget is a
 * bare serial line: the host raises the break, releases it and streams the
 * start code plus 512 slots at 250 kbaud with two stop bits. A DMX USB Pro
 * takes a framed packet (label 6, little-endian length, payload, end byte)
 * over an ordinary serial link and times the wire itself.
 */
export interface SerialFraming {
  readonly options: SerialOptions;
  send(link: SerialLink, frame: Uint8Array): Promise<void>;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const openDmxFraming: SerialFraming = {
  options: { baudRate: 250_000, dataBits: 8, stopBits: 2, parity: "none" },
  async send(link, frame) {
    await link.setBreak(true);
    await sleep(settings.output.openDmxBreakMs);
    await link.setBreak(false);
    const packet = new Uint8Array(frame.length + 1);
    packet.set(frame, 1);
    await link.write(packet);
  },
};

const USB_PRO_START = 0x7e;
const USB_PRO_END = 0xe7;
const USB_PRO_SEND_DMX = 6;

/** The DMX USB Pro packet for a frame: start, label, length, start code, slots, end. */
export function usbProPacket(frame: Uint8Array): Uint8Array {
  const length = frame.length + 1;
  const packet = new Uint8Array(length + 5);
  packet[0] = USB_PRO_START;
  packet[1] = USB_PRO_SEND_DMX;
  packet[2] = length & 0xff;
  packet[3] = (length >> 8) & 0xff;
  packet[4] = 0;
  packet.set(frame, 5);
  packet[packet.length - 1] = USB_PRO_END;
  return packet;
}

export const usbProFraming: SerialFraming = {
  options: { baudRate: 57_600, dataBits: 8, stopBits: 1, parity: "none" },
  send: (link, frame) => link.write(usbProPacket(frame)),
};

/**
 * Why no port matched an Output's `device`: a path (`/dev/ttyUSB0`,
 * `COM3`) is reported as a path, anything else as a serial number.
 */
export function missingWidgetMessage(device: string): string {
  if (device === ANY_DEVICE) return "No serial DMX widget found.";
  const path = /^(\/|\\\\|COM\d+$)/i.test(device);
  return path
    ? `No widget at path ${device}.`
    : `No widget with serial number ${device}.`;
}

/** A serial widget's driver: the port the Output names, framed the family's way. */
export function serialDriver(
  ports: () => Promise<SerialPortFactory>,
  framing: SerialFraming,
): OutputDriver {
  return {
    async open(device) {
      const factory = await ports();
      const port = pickPort(await factory.list(), device);
      if (port === undefined)
        throw new DeviceMissingError(missingWidgetMessage(device));
      const link = await factory.open(port.path, framing.options);
      return {
        location: port.path,
        send: (frame) => framing.send(link, frame),
        close: () => link.close(),
        onClose: (listener) => {
          link.onClose(listener);
        },
      };
    },
  };
}
