import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { completeDirectoryPath, validateDirectoryPath } from "./paths.js";

const tempDirs: string[] = [];

async function tempHome(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "pi-deck-paths-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("path helpers", () => {
  it("validates an existing directory", async () => {
    const home = await tempHome();
    await expect(validateDirectoryPath(home)).resolves.toEqual({ ok: true, path: home });
  });

  it("returns a clear error for files", async () => {
    const home = await tempHome();
    const file = join(home, "file.txt");
    await writeFile(file, "x");

    await expect(validateDirectoryPath(file)).resolves.toEqual({ ok: false, error: `Path is not a directory: ${file}` });
  });

  it("returns a clear error for missing paths", async () => {
    const missing = join(await tempHome(), "missing");

    await expect(validateDirectoryPath(missing)).resolves.toEqual({ ok: false, error: `Path does not exist: ${missing}` });
  });

  it("suggests matching child directories under home", async () => {
    const home = await tempHome();
    await mkdir(join(home, "Projects"));
    await mkdir(join(home, "Pictures"));

    await expect(completeDirectoryPath("~/P", { home, cwd: "/tmp" })).resolves.toEqual({
      suggestions: ["~/Pictures/", "~/Projects/"],
    });
  });

  it("completes the shared prefix when multiple directories match", async () => {
    const home = await tempHome();
    await mkdir(join(home, "ProjectAlpha"));
    await mkdir(join(home, "ProjectBeta"));

    await expect(completeDirectoryPath("~/Pro", { home, cwd: "/tmp" })).resolves.toEqual({
      completed: "~/Project",
      suggestions: ["~/ProjectAlpha/", "~/ProjectBeta/"],
    });
  });

  it("completes a single matching directory with a trailing slash", async () => {
    const home = await tempHome();
    await mkdir(join(home, "Projects"));

    await expect(completeDirectoryPath("~/Pro", { home, cwd: "/tmp" })).resolves.toEqual({
      completed: "~/Projects/",
      suggestions: ["~/Projects/"],
    });
  });

  it("does not suggest files", async () => {
    const home = await tempHome();
    await writeFile(join(home, "Project.txt"), "x");

    await expect(completeDirectoryPath("~/Pro", { home, cwd: "/tmp" })).resolves.toEqual({ completed: undefined, suggestions: [] });
  });
});
