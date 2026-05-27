import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerCommands } from "./commands.js";

export default function piDeckExtension(pi: ExtensionAPI): void {
  registerCommands(pi);
}
