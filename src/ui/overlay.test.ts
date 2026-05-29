import { describe, expect, it } from "vitest";
import { dashboardOverlayOptions } from "./dashboard.js";

describe("dashboard overlay options", () => {
  it("uses 80 percent responsive sizing", () => {
    expect(dashboardOverlayOptions()).toEqual({ anchor: "center", width: "80%", maxHeight: "80%" });
  });
});
