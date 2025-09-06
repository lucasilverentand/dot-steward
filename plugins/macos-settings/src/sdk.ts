import { ShellPlugin } from "../../shell/src/plugin.ts";
import type { MacSettings } from "./schema.ts";
import { MacSettingsItem } from "./item.ts";

export function mac_settings(cfg: MacSettings, opts?: { plugin?: ShellPlugin }) {
  return new MacSettingsItem(cfg, opts?.plugin);
}

