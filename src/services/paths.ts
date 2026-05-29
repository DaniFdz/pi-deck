import { readdir, stat } from "node:fs/promises";
import { basename, dirname, join, sep } from "node:path";
import { normalizePath } from "./git.js";

export type DirectoryValidation = { ok: true; path: string } | { ok: false; error: string };
export interface CompletionOptions {
  home: string;
  cwd: string;
}
export interface DirectoryCompletion {
  completed?: string;
  suggestions: string[];
}

export async function validateDirectoryPath(path: string): Promise<DirectoryValidation> {
  try {
    const info = await stat(path);
    if (!info.isDirectory()) return { ok: false, error: `Path is not a directory: ${path}` };
    return { ok: true, path };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { ok: false, error: `Path does not exist: ${path}` };
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function splitInputPath(input: string): { typedDir: string; partial: string } {
  if (input.endsWith("/")) return { typedDir: input, partial: "" };
  const dir = dirname(input);
  const typedDir = dir === "." ? "" : `${dir}/`;
  return { typedDir, partial: basename(input) };
}

function displayPathFor(inputDir: string, child: string): string {
  return `${inputDir}${child}/`;
}

export async function completeDirectoryPath(input: string, options: CompletionOptions): Promise<DirectoryCompletion> {
  const { typedDir, partial } = splitInputPath(input.trim());
  const absoluteDir = normalizePath(typedDir || ".", options.home, options.cwd);
  let entries: string[];
  try {
    entries = await readdir(absoluteDir);
  } catch {
    return { suggestions: [] };
  }

  const matches: string[] = [];
  for (const entry of entries.sort((a, b) => a.localeCompare(b))) {
    if (!entry.startsWith(partial)) continue;
    const absoluteEntry = join(absoluteDir, entry);
    try {
      if ((await stat(absoluteEntry)).isDirectory()) matches.push(displayPathFor(typedDir, entry));
    } catch {
      // Ignore entries that disappear during completion.
    }
  }
  return { completed: matches.length === 1 ? matches[0] : undefined, suggestions: matches };
}
