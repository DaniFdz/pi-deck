import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { getDefaultConfigPath, loadConfig, parseConfig } from "./config.js";

const tempDirs: string[] = [];

async function tempHome(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "pi-deck-config-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("config service", () => {
  it("uses defaults when the config file is missing", async () => {
    const home = await tempHome();

    await expect(loadConfig({ home })).resolves.toEqual({
      home,
      sessionCreation: { branchPrefix: "", worktreeBasePath: "", defaultPath: "~" }
    });
  });

  it("parses session creation settings from TOML", () => {
    expect(parseConfig('[session_creation]\nbranch_prefix = "dani.fernandez/"\nworktree_base_path = "~/.worktrees"\ndefault_path = "~/projects"\n')).toEqual({
      home: process.env.HOME ?? "",
      sessionCreation: { branchPrefix: "dani.fernandez/", worktreeBasePath: "~/.worktrees", defaultPath: "~/projects" },
    });
  });

  it("loads the default config path under the Pi Deck config directory", async () => {
    const home = await tempHome();
    const configPath = getDefaultConfigPath(home);
    await writeFile(configPath, '[session_creation]\nbranch_prefix = "team/"\n', { flag: "wx" }).catch(async (error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
      await import("node:fs/promises").then(({ mkdir }) => mkdir(join(home, ".pi", "agent", "pi-deck"), { recursive: true }));
      await writeFile(configPath, '[session_creation]\nbranch_prefix = "team/"\n');
    });

    await expect(loadConfig({ home })).resolves.toEqual({
      home,
      sessionCreation: { branchPrefix: "team/", worktreeBasePath: "", defaultPath: "~" }
    });
  });

  it("defaults the config path to ~/.pi/agent/pi-deck/config.toml", () => {
    expect(getDefaultConfigPath("/Users/example")).toBe("/Users/example/.pi/agent/pi-deck/config.toml");
  });
});
