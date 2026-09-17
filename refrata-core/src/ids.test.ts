import { afterEach, expect, it, vi } from "vitest";

import { generateId } from "./ids.ts";

afterEach(() => vi.unstubAllGlobals());

it("generates IDs when crypto.randomUUID is unavailable over HTTP", () => {
  const { crypto } = globalThis as unknown as {
    crypto: { getRandomValues(bytes: Uint8Array): Uint8Array };
  };
  vi.stubGlobal("crypto", {
    getRandomValues: crypto.getRandomValues.bind(crypto),
  });

  const first = generateId("fixture");
  const second = generateId("fixture");
  expect(first).toMatch(/^fixture_[0-9a-f]{12}$/);
  expect(second).toMatch(/^fixture_[0-9a-f]{12}$/);
  expect(second).not.toBe(first);
  expect(generateId("studio")).toMatch(/^studio_[0-9a-f]{12}$/);
});
