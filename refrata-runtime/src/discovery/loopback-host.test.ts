import { describe, expect, it } from "vitest";

import { isLoopbackHost } from "./loopback-host.ts";

describe("loopback host", () => {
  it("is the 127.0.0.0/8 block, ::1 and localhost", () => {
    for (const host of [
      "127.0.0.1",
      "127.1.2.3",
      "::1",
      "[::1]",
      "::ffff:127.0.0.1",
      "localhost",
      "LOCALHOST",
    ])
      expect(isLoopbackHost(host), host).toBe(true);
  });

  it("is not an address the network can reach, nor a name that only looks like one", () => {
    for (const host of [
      "0.0.0.0",
      "::",
      "192.168.1.20",
      "10.127.0.1",
      "1127.0.0.1",
      "127.0.0.1.example",
      "mini-pc.local",
    ])
      expect(isLoopbackHost(host), host).toBe(false);
  });
});
