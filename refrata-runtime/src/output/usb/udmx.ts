import { ANY_DEVICE } from "@refrata/core";

import { DeviceMissingError, type OutputDriver } from "../output-driver.ts";
import type { UsbDeviceInfo, UsbFactory } from "./usb-device.ts";

/**
 * Anyma's uDMX and its clones. The vendor and product ids are a pair shared
 * by many hobby USB devices, so the product name is what identifies one.
 * There is no serial port: the host sets slots with vendor control
 * transfers, and the device's own firmware keeps streaming DMX from what it
 * holds.
 */
const UDMX_VENDOR_ID = 0x16c0;
const UDMX_PRODUCT_ID = 0x05dc;
const UDMX_PRODUCT_NAME = "uDMX";
/** `cmd_SetChannelRange`: value is the slot count, index the first slot (0-based), data the slots. */
const SET_CHANNEL_RANGE = 2;

/**
 * The uDMX an Output names: `any` for the first one, else a port location
 * or a serial number. Clones usually share one serial number, so a serial
 * number that several devices carry is an error naming their locations.
 * A device on the shared ids that cannot be read is passed over while
 * another matches; when none does it may be the uDMX, so it is an error
 * saying how to give access, not a missing device.
 */
export function pickUdmx(
  devices: readonly UsbDeviceInfo[],
  device: string,
): UsbDeviceInfo {
  const udmxs = devices
    .filter((candidate) => candidate.productName === UDMX_PRODUCT_NAME)
    .toSorted((a, b) => a.location.localeCompare(b.location));
  const missing = (message: string): Error => {
    const unreadable = devices
      .filter((candidate) => candidate.unreadable !== undefined)
      .map(
        (candidate) =>
          `${candidate.location} (${candidate.unreadable ?? "unknown"})`,
      );
    if (unreadable.length === 0) return new DeviceMissingError(message);
    return new Error(
      `${message} Cannot read the USB device at ${unreadable.join(", ")}; on Linux a udev rule must give your user access to it.`,
    );
  };
  if (device === ANY_DEVICE) {
    const first = udmxs[0];
    if (first === undefined) throw missing("No uDMX found.");
    return first;
  }
  const atLocation = udmxs.find((candidate) => candidate.location === device);
  if (atLocation !== undefined) return atLocation;
  const withSerial = udmxs.filter(
    (candidate) => candidate.serialNumber === device,
  );
  const [only, ...others] = withSerial;
  if (only === undefined)
    throw missing(`No uDMX with serial number or port location ${device}.`);
  if (others.length > 0)
    throw new Error(
      `${String(withSerial.length)} uDMX devices share serial number ${device}; name one by port location: ${withSerial.map((candidate) => candidate.location).join(", ")}.`,
    );
  return only;
}

/** The slots that differ between two frames as `[start, end)`, or undefined when none do. */
export function changedRange(
  previous: Uint8Array | undefined,
  frame: Uint8Array,
): readonly [number, number] | undefined {
  if (previous === undefined) return [0, frame.length];
  let start = 0;
  while (start < frame.length && frame[start] === previous[start]) start += 1;
  if (start === frame.length) return undefined;
  let end = frame.length;
  while (frame[end - 1] === previous[end - 1]) end -= 1;
  return [start, end];
}

/**
 * The uDMX driver sends only what changed since the last frame the device
 * took, as one range, and nothing when nothing did: the device holds its
 * slots, and on this low-speed link every transfer costs time (a whole
 * frame takes about 35 ms) and risks the device dropping off the bus. A
 * freshly opened device's slots are unknown, so its first frame goes whole.
 */
export function udmxDriver(usb: () => Promise<UsbFactory>): OutputDriver {
  return {
    async open(device) {
      const factory = await usb();
      const { location } = pickUdmx(
        await factory.list(UDMX_VENDOR_ID, UDMX_PRODUCT_ID),
        device,
      );
      const handle = await factory.open(location);
      let held: Uint8Array | undefined;
      return {
        location,
        async send(frame) {
          const copy = Uint8Array.from(frame);
          const range = changedRange(held, copy);
          if (range === undefined) return;
          const [start, end] = range;
          await handle.controlOut(
            { request: SET_CHANNEL_RANGE, value: end - start, index: start },
            copy.subarray(start, end),
          );
          held = copy;
        },
        close: () => handle.close(),
        onClose: (listener) => {
          handle.onClose(listener);
        },
      };
    },
  };
}
