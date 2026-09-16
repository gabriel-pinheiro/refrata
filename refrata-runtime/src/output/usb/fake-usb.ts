import { DeviceMissingError } from "../output-driver.ts";
import type {
  UsbDeviceInfo,
  UsbFactory,
  UsbHandle,
  VendorRequest,
} from "./usb-device.ts";

/**
 * A USB factory for tests: the devices it lists are given, and every handle
 * records the control transfers a driver made on it.
 */
export interface FakeUsbHandle extends UsbHandle {
  readonly location: string;
  readonly transfers: (VendorRequest & { readonly data: Uint8Array })[];
  readonly closed: boolean;
  /** Pretend the device was unplugged. */
  vanish(error?: Error): void;
}

export interface FakeUsb {
  readonly factory: UsbFactory;
  readonly handles: FakeUsbHandle[];
  devices: UsbDeviceInfo[];
}

export function fakeUsbFactory(devices: UsbDeviceInfo[]): FakeUsb {
  const handles: FakeUsbHandle[] = [];
  const fake: FakeUsb = {
    devices,
    handles,
    factory: {
      list: (vendorId, productId) =>
        Promise.resolve(
          fake.devices.filter(
            (device) =>
              device.vendorId === vendorId && device.productId === productId,
          ),
        ),
      open(location) {
        if (!fake.devices.some((device) => device.location === location))
          return Promise.reject(
            new DeviceMissingError(`No USB device at ${location}.`),
          );
        const closeListeners: ((error: Error | undefined) => void)[] = [];
        let closed = false;
        const handle: FakeUsbHandle = {
          location,
          transfers: [],
          get closed() {
            return closed;
          },
          controlOut(setup, data) {
            if (closed)
              return Promise.reject(new Error("The device went away."));
            handle.transfers.push({ ...setup, data: Uint8Array.from(data) });
            return Promise.resolve();
          },
          close() {
            closed = true;
            return Promise.resolve();
          },
          onClose(listener) {
            closeListeners.push(listener);
          },
          vanish(error) {
            closed = true;
            for (const listener of closeListeners) listener(error);
          },
        };
        handles.push(handle);
        return Promise.resolve(handle);
      },
    },
  };
  return fake;
}

export const UDMX_DEVICE: UsbDeviceInfo = {
  vendorId: 0x16c0,
  productId: 0x05dc,
  location: "3-4",
  productName: "uDMX",
  serialNumber: "ilLUTZminator001",
};
