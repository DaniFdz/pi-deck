import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEmptyDeck } from "./deck-operations.js";
import { loadDeck, saveDeck } from "./store.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "pi-deck-store-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("store", () => {
  it("loads an empty deck when the file does not exist", async () => {
    const deck = await loadDeck(join(dir, "deck.json"), "2026-05-28T00:00:00.000Z");
    expect(deck.groups[0]?.id).toBe("root");
    expect(deck.sessions).toEqual([]);
  });

  it("saves and loads deck JSON", async () => {
    const path = join(dir, "deck.json");
    const deck = createEmptyDeck("2026-05-28T00:00:00.000Z");

    await saveDeck(path, deck);
    const loaded = await loadDeck(path);

    expect(loaded).toEqual(deck);
  });

  it("backs up invalid JSON and returns an empty deck", async () => {
    const path = join(dir, "deck.json");
    await writeFile(path, "{not json", "utf8");

    const loaded = await loadDeck(path, "2026-05-28T01:00:00.000Z");
    const files = await readFile(path, "utf8");
    const backupFiles = (await readdir(dir)).filter((file) => file.startsWith("deck.json.bak."));

    expect(loaded.groups[0]?.id).toBe("root");
    expect(files).toContain('"version": 1');
    expect(backupFiles).toHaveLength(1);
    await expect(readFile(join(dir, backupFiles[0] ?? ""), "utf8")).resolves.toBe("{not json");
  });
});
