import { homedir } from "node:os";
import { join } from "node:path";

export const DECK_VERSION = 1;
export const ROOT_GROUP_ID = "root";
export const DEFAULT_STORE_PATH = join(homedir(), ".pi", "agent", "deck.json");
export const TMUX_SESSION_PREFIX = "pi-deck-";
