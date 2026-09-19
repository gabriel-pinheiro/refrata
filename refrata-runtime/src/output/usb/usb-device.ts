import { DeviceMissingError } from "../output-driver.ts";

/**
 * The slice of USB a USB Output driver needs, so drivers are tested against
 * a fake and the native `usb` module is loaded only when a device is opened.
 */
export interface UsbDeviceInfo {
  readonly vendorId: number;
  readonly productId: number;
  /** Where the device is plugged in, as the kernel names it: bus, then the port chain (`3-4`, `1-2.3`). */
  readonly location: string;
  readonly productName: string | undefined;
  readonly serialNumber: string | undefined;
  /** Why the names could not be read, when the device refused to be opened for them. */
  readonly unreadable?: string;
}

/** A vendor control transfer from host to device. */
export interface VendorRequest {
  readonly request: number;
  readonly value: number;
  readonly index: number;
}

export interface UsbHandle {
  controlOut(setup: VendorRequest, data: Uint8Array): Promise<void>;
  close(): Promise<void>;
  /** Called once when the device goes away under us. */
  onClose(listener: (error: Error | undefined) => void): void;
}

export interface UsbFactory {
  /**
   * The devices with this vendor and product id. Names are read only for
   * these: reading a device's names opens it, which other devices on the
   * bus may refuse. One that refuses is listed as `unreadable` rather than
   * failing the list, since the ids may be shared with devices that are not
   * ours to open.
   */
  list(vendorId: number, productId: number): Promise<readonly UsbDeviceInfo[]>;
  open(location: string): Promise<UsbHandle>;
}

interface NodeUsbDevice extends USBDevice {
  readonly bus: string;
  readonly address: number;
  readonly ports: readonly number[];
}

const locationOf = (device: NodeUsbDevice): string =>
  `${String(Number(device.bus))}-${device.ports.join(".")}`;

/** The real thing, loaded on first use so a runtime without the native module still starts. */
export async function nodeUsbFactory(): Promise<UsbFactory> {
  const { usb } = await import("usb");
  const devices = (): Promise<NodeUsbDevice[]> => usb.getDevices();
  return {
    async list(vendorId, productId) {
      const matching = (await devices()).filter(
        (device) =>
          device.vendorId === vendorId && device.productId === productId,
      );
      return matching.map((device) => {
        const location = locationOf(device);
        try {
          return {
            vendorId,
            productId,
            location,
            productName: device.productName ?? undefined,
            serialNumber: device.serialNumber ?? undefined,
          };
        } catch (error) {
          return {
            vendorId,
            productId,
            location,
            productName: undefined,
            serialNumber: undefined,
            unreadable: error instanceof Error ? error.message : String(error),
          };
        }
      });
    },
    async open(location) {
      const device = (await devices()).find(
        (candidate) => locationOf(candidate) === location,
      );
      if (device === undefined)
        throw new DeviceMissingError(`No USB device at ${location}.`);
      await device.open();
      const listeners: ((error: Error | undefined) => void)[] = [];
      let closed = false;
      const onDisconnect = (event: USBConnectionEvent): void => {
        const gone = event.device as NodeUsbDevice;
        if (gone.bus !== device.bus || gone.address !== device.address) return;
        if (closed) return;
        closed = true;
        usb.removeEventListener("disconnect", onDisconnect);
        for (const listener of listeners)
          listener(new Error("The device went away."));
      };
      usb.addEventListener("disconnect", onDisconnect);
      return {
        async controlOut(setup, data) {
          const result = await device.controlTransferOut(
            { requestType: "vendor", recipient: "device", ...setup },
            new Uint8Array(data),
          );
          if (result.status !== "ok")
            throw new Error(`The USB transfer ended with ${result.status}.`);
        },
        async close() {
          if (closed) return;
          closed = true;
          usb.removeEventListener("disconnect", onDisconnect);
          await device.close().catch(() => undefined);
        },
        onClose: (listener) => {
          listeners.push(listener);
        },
      };
    },
  };
}
