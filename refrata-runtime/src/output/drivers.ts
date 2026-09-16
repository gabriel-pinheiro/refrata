import type { OutputKind } from "@refrata/core";

import type { OutputDriver } from "./output-driver.ts";
import {
  openDmxFraming,
  serialDriver,
  usbProFraming,
} from "./serial/enttec.ts";
import {
  nodeSerialFactory,
  type SerialPortFactory,
} from "./serial/serial-port.ts";
import { udmxDriver } from "./usb/udmx.ts";
import { nodeUsbFactory, type UsbFactory } from "./usb/usb-device.ts";

/** Where each transport family reaches the hardware; the native modules unless a test supplies fakes. */
export interface DriverSources {
  readonly serial?: () => Promise<SerialPortFactory>;
  readonly usb?: () => Promise<UsbFactory>;
}

export type OutputDrivers = Readonly<Record<OutputKind, OutputDriver>>;

/** Every Output kind's driver. A native module loads on the first open that needs it, and again if that failed. */
export function createDrivers(sources: DriverSources = {}): OutputDrivers {
  const serial = once(sources.serial ?? nodeSerialFactory);
  const usb = once(sources.usb ?? nodeUsbFactory);
  return {
    "enttec-open-dmx": serialDriver(serial, openDmxFraming),
    "enttec-usb-pro": serialDriver(serial, usbProFraming),
    "anyma-udmx": udmxDriver(usb),
  };
}

function once<T>(load: () => Promise<T>): () => Promise<T> {
  let loaded: Promise<T> | undefined;
  return () =>
    (loaded ??= load().catch((error: unknown) => {
      loaded = undefined;
      throw error;
    }));
}
