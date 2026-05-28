import { describe, expect, it } from "vitest";
import { normalizeInputValue } from "./selectors.js";

describe("selector helpers", () => {
  it("uses the fallback when input is empty", () => {
    expect(normalizeInputValue("", "api-fix")).toBe("api-fix");
    expect(normalizeInputValue("   ", "/tmp/project")).toBe("/tmp/project");
  });

  it("returns undefined when input is cancelled", () => {
    expect(normalizeInputValue(undefined, "api-fix")).toBeUndefined();
  });

  it("trims typed input", () => {
    expect(normalizeInputValue("  custom  ", "api-fix")).toBe("custom");
  });
});
