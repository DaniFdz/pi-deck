import { describe, expect, it } from "vitest";
import { dashboardBodyHeight } from "./dashboard.js";

describe("dashboard height", () => {
  it("sizes body so full dashboard uses about 80 percent of terminal height", () => {
    expect(dashboardBodyHeight(40)).toBe(25);
  });

  it("keeps a usable minimum body height on short terminals", () => {
    expect(dashboardBodyHeight(15)).toBe(8);
  });
});
