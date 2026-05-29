import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface PiDeckConfig {
  home: string;
  sessionCreation: {
    branchPrefix: string;
    worktreeBasePath: string;
  };
}

const DEFAULT_SESSION_CREATION = {
  branchPrefix: "",
  worktreeBasePath: "",
};

export function getDefaultConfigPath(home = process.env.HOME ?? ""): string {
  return join(home, ".pi", "agent", "pi-deck", "config.toml");
}

export function parseConfig(source: string): PiDeckConfig {
  const config: PiDeckConfig = {
    home: process.env.HOME ?? "",
    sessionCreation: { ...DEFAULT_SESSION_CREATION },
  };
  let section = "";
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line) continue;
    const sectionMatch = line.match(/^\[([^\]]+)]$/);
    if (sectionMatch) {
      section = sectionMatch[1] ?? "";
      continue;
    }
    if (section !== "session_creation") continue;
    const settingMatch = line.match(/^([A-Za-z0-9_-]+)\s*=\s*"(.*)"\s*$/);
    if (!settingMatch) continue;
    const key = settingMatch[1];
    const value = (settingMatch[2] ?? "").replace(/\\"/g, '"');
    if (key === "branch_prefix") config.sessionCreation.branchPrefix = value;
    if (key === "worktree_base_path") config.sessionCreation.worktreeBasePath = value;
  }
  return config;
}

export async function loadConfig(options: { home?: string; configPath?: string } = {}): Promise<PiDeckConfig> {
  const home = options.home ?? process.env.HOME ?? "";
  const path = options.configPath ?? getDefaultConfigPath(home);
  try {
    const config = parseConfig(await readFile(path, "utf8"));
    return { ...config, home };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { home, sessionCreation: { ...DEFAULT_SESSION_CREATION } };
    throw error;
  }
}
