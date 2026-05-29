import { describe, expect, it } from "vitest";
import { normalizeInputValue } from "./selectors.js";

describe("selector helpers", () => {
  it("rejects empty input", () => {
    expect(normalizeInputValue("", "api-fix")).toBeUndefined();
    expect(normalizeInputValue("   ", "/tmp/project")).toBeUndefined();
  });

  it("returns undefined when input is cancelled", () => {
    expect(normalizeInputValue(undefined, "api-fix")).toBeUndefined();
  });

  it("trims typed input", () => {
    expect(normalizeInputValue("  custom  ", "api-fix")).toBe("custom");
  });
});
