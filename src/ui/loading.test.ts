import { describe, expect, it, vi } from "vitest";
import { withLoading } from "./loading.js";

describe("withLoading", () => {
  it("runs the task while showing a loading message", async () => {
    const custom = vi.fn(async (factory, _options) => {
      let result: unknown;
      factory({ requestRender: vi.fn() }, { fg: (_color: string, text: string) => text }, {}, (value: unknown) => { result = value; });
      await Promise.resolve();
      return result;
    });
    const ctx = { ui: { custom } } as any;

    const result = await withLoading(ctx, "Creating worktree... (this might take a while)", async () => "task-result");

    expect(result).toBe("task-result");
    expect(custom).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ overlay: true }));
  });

  it("propagates task failures", async () => {
    const custom = vi.fn(async (factory, _options) => {
      let result: unknown;
      factory({ requestRender: vi.fn() }, { fg: (_color: string, text: string) => text }, {}, (value: unknown) => { result = value; });
      await Promise.resolve();
      return result;
    });
    const ctx = { ui: { custom } } as any;

    await expect(withLoading(ctx, "Creating worktree... (this might take a while)", async () => { throw new Error("git failed"); })).rejects.toThrow("git failed");
  });
});
