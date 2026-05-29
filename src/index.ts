import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerCommands } from "./commands/register.js";

export default function piDeckExtension(pi: ExtensionAPI): void {
  registerCommands(pi);
}
