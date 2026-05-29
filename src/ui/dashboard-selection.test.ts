import { describe, expect, it } from "vitest";
import { nextSelectedRowId } from "./dashboard.js";

describe("dashboard selection", () => {
  it("preserves selected row when it still exists after reorder", () => {
    expect(nextSelectedRowId("session:ses_1", ["group:root", "session:ses_2", "session:ses_1"])).toBe("session:ses_1");
  });

  it("falls back to the first row when selected row disappeared", () => {
    expect(nextSelectedRowId("session:deleted", ["group:root", "session:ses_1"])).toBe("group:root");
  });
});
