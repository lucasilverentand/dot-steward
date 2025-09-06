import type { ShellPlugin } from "../../shell/src/plugin.ts";
import { MacSettingsItem } from "./item.ts";
import type { MacSettings } from "./schema.ts";

export function mac_settings(
  cfg: MacSettings,
  opts?: { plugin?: ShellPlugin },
) {
  return new MacSettingsItem(cfg, opts?.plugin);
}
