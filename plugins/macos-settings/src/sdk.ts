import type { ExecPlugin } from "../../exec/src/plugin.ts";
import { MacSettingsItem } from "./item.ts";
import type { MacSettings } from "./schema.ts";

export function mac_settings(cfg: MacSettings, opts?: { plugin?: ExecPlugin }) {
  return new MacSettingsItem(cfg, opts?.plugin);
}
