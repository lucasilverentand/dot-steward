import { z } from "zod";
import { Item, os as hostOS } from "@dot-steward/core";
import type { HostContext } from "@dot-steward/core";
import type { ItemPlan, ItemStatus } from "@dot-steward/core";
import { ShellPlugin } from "../../shell/src/plugin.ts";

type WriteType = "-bool" | "-int" | "-float" | "-string";

type Rule = {
  path: string[]; // e.g. ["dock","autohide"]
  domain: string;
  key: string;
  type: WriteType;
  opts?: { global?: boolean; currentHost?: boolean };
  // Map the input value to a string suitable for defaults
  map?: (value: unknown) => string;
  // Name of process to restart (killall), e.g. "Dock"
  restart?: string;
};

// Zod schemas describing supported macOS settings
// Categories are optional; unknown keys are rejected for safety.

const MouseSchema = z
  .object({
    // com.apple.mouse.scaling (float). Typical range ~0..3; allow 0..10 to be safe.
    speed: z.number().min(0).max(10).optional(),
    // com.apple.swipescrolldirection (bool) — true = natural
    natural_scrolling: z.boolean().optional(),
    // Enable tap to click (applies to trackpads and BT trackpads)
    tap_to_click: z.boolean().optional(),
  })
  .strict();

const DockSchema = z
  .object({
    autohide: z.boolean().optional(), // com.apple.dock autohide
    tilesize: z.number().int().min(16).max(128).optional(), // com.apple.dock tilesize
    magnification: z.boolean().optional(), // com.apple.dock magnification
    largesize: z.number().int().min(16).max(256).optional(), // com.apple.dock largesize
    orientation: z.enum(["left", "bottom", "right"]).optional(), // com.apple.dock orientation
    minimize_to_application: z.boolean().optional(), // com.apple.dock minimize-to-application
    mineffect: z.enum(["genie", "scale"]).optional(), // com.apple.dock mineffect
    show_recents: z.boolean().optional(), // com.apple.dock show-recents
    autohide_delay: z.number().min(0).max(10).optional(), // com.apple.dock autohide-delay
    autohide_time: z.number().min(0).max(10).optional(), // com.apple.dock autohide-time-modifier
  })
  .strict();

const FinderSchema = z
  .object({
    show_hidden: z.boolean().optional(), // com.apple.finder AppleShowAllFiles
    show_path_bar: z.boolean().optional(), // com.apple.finder ShowPathbar
    show_status_bar: z.boolean().optional(), // com.apple.finder ShowStatusBar
    extension_change_warning: z.boolean().optional(), // com.apple.finder FXEnableExtensionChangeWarning
  })
  .strict();

const KeyboardSchema = z
  .object({
    key_repeat: z.number().int().min(1).max(120).optional(), // NSGlobalDomain KeyRepeat
    initial_key_repeat: z.number().int().min(10).max(120).optional(), // NSGlobalDomain InitialKeyRepeat
    press_and_hold: z.boolean().optional(), // NSGlobalDomain ApplePressAndHoldEnabled (true = press-and-hold)
  })
  .strict();

const ScreenshotSchema = z
  .object({
    location: z.string().min(1).optional(), // com.apple.screencapture location (path)
    type: z.enum(["png", "jpg", "tiff", "pdf", "heic"]).optional(), // com.apple.screencapture type
    disable_shadow: z.boolean().optional(), // com.apple.screencapture disable-shadow
  })
  .strict();

const GlobalSchema = z
  .object({
    // Auto-hide menu bar: NSGlobalDomain _HIHideMenuBar
    auto_hide_menu_bar: z.boolean().optional(),
    // Save to iCloud by default for new documents (false = save to disk)
    save_to_icloud_by_default: z.boolean().optional(), // NSDocumentSaveNewDocumentsToCloud
  })
  .strict();

export const MacSettingsSchema = z
  .object({
    mouse: MouseSchema.optional(),
    dock: DockSchema.optional(),
    finder: FinderSchema.optional(),
    keyboard: KeyboardSchema.optional(),
    screenshot: ScreenshotSchema.optional(),
    global: GlobalSchema.optional(),
  })
  .strict();

export type MacSettings = z.infer<typeof MacSettingsSchema>;

// Item: applies macOS settings via `defaults write` + targeted restarts
class MacSettingsItem extends Item {
  readonly matches = hostOS("darwin");
  readonly plugin_key = "shell";
  readonly plugin?: ShellPlugin;
  private cfg: MacSettings;

  constructor(cfg: MacSettings, plugin?: ShellPlugin) {
    super({ kind: "macos:settings", requires: plugin ? [plugin.id] : [] });
    this.cfg = cfg;
    this.plugin = plugin;
  }

  private getAt(obj: unknown, path: string[]): unknown {
    let cur: unknown = obj;
    for (const p of path) {
      if (cur === null || cur === undefined) return undefined;
      cur = (cur as any)[p];
    }
    return cur;
  }

  get_plugin_factory(): ShellPlugin {
    return new ShellPlugin();
  }

  async probe(_ctx: HostContext): Promise<ItemStatus> {
    // For now, always plan to apply (idempotent writes). Future: compare with defaults read.
    this.set_status("pending");
    return this.state.status;
  }

  async validate(_ctx: HostContext): Promise<void> {
    // Validate config using Zod
    this.cfg = MacSettingsSchema.parse(this.cfg);
  }

  async plan(_ctx: HostContext): Promise<ItemPlan | null> {
    const cats: string[] = [];
    if (this.cfg.mouse) cats.push("mouse");
    if (this.cfg.dock) cats.push("dock");
    if (this.cfg.finder) cats.push("finder");
    if (this.cfg.keyboard) cats.push("keyboard");
    if (this.cfg.screenshot) cats.push("screenshot");
    if (this.cfg.global) cats.push("global");
    const label = cats.length > 0 ? cats.join(", ") : "none";
    return { summary: `macOS settings (${label})` };
  }

  private async run(cmd: string, ctx: HostContext) {
    // Prefer ShellPlugin to leverage sudo prompting behavior if needed
    const res = this.plugin
      ? await this.plugin.run(cmd, { shell: "sh", cwd: ctx.user.home ?? "." }, ctx)
      : await (await import("../../shell/src/exec.ts")).runShell(cmd, {
          shell: "sh",
          cwd: ctx.user.home ?? ".",
        });
    if (!res.ok) throw new Error(res.stderr || `command failed: ${cmd}`);
  }

  private async defaultsWrite(
    ctx: HostContext,
    domain: string,
    key: string,
    type: WriteType,
    value: string,
    opts?: { global?: boolean; currentHost?: boolean },
  ) {
    const domainArg = opts?.global ? "-g" : domain;
    const hostFlag = opts?.currentHost ? "-currentHost " : "";
    const cmd = `defaults ${hostFlag}write ${domainArg} ${key} ${type} ${value}`;
    await this.run(cmd, ctx);
  }

  async apply(ctx: HostContext): Promise<void> {
    const restart = new Set<string>();

    const rules: Rule[] = [
      // mouse
      {
        path: ["mouse", "speed"],
        domain: "NSGlobalDomain",
        key: "com.apple.mouse.scaling",
        type: "-float",
        opts: { global: true },
      },
      {
        path: ["mouse", "natural_scrolling"],
        domain: "NSGlobalDomain",
        key: "com.apple.swipescrolldirection",
        type: "-bool",
        opts: { global: true },
      },
      {
        path: ["mouse", "tap_to_click"],
        domain: "com.apple.AppleMultitouchTrackpad",
        key: "Clicking",
        type: "-bool",
        restart: "SystemUIServer",
      },
      {
        path: ["mouse", "tap_to_click"],
        domain: "com.apple.driver.AppleBluetoothMultitouch.trackpad",
        key: "Clicking",
        type: "-bool",
        restart: "SystemUIServer",
      },
      {
        path: ["mouse", "tap_to_click"],
        domain: "NSGlobalDomain",
        key: "com.apple.mouse.tapBehavior",
        type: "-int",
        opts: { global: true, currentHost: true },
        map: (v) => (v ? "1" : "0"),
        restart: "SystemUIServer",
      },
      // dock
      {
        path: ["dock", "autohide"],
        domain: "com.apple.dock",
        key: "autohide",
        type: "-bool",
        restart: "Dock",
      },
      {
        path: ["dock", "tilesize"],
        domain: "com.apple.dock",
        key: "tilesize",
        type: "-int",
        restart: "Dock",
      },
      {
        path: ["dock", "magnification"],
        domain: "com.apple.dock",
        key: "magnification",
        type: "-bool",
        restart: "Dock",
      },
      {
        path: ["dock", "largesize"],
        domain: "com.apple.dock",
        key: "largesize",
        type: "-int",
        restart: "Dock",
      },
      {
        path: ["dock", "orientation"],
        domain: "com.apple.dock",
        key: "orientation",
        type: "-string",
        restart: "Dock",
      },
      {
        path: ["dock", "minimize_to_application"],
        domain: "com.apple.dock",
        key: "minimize-to-application",
        type: "-bool",
        restart: "Dock",
      },
      {
        path: ["dock", "mineffect"],
        domain: "com.apple.dock",
        key: "mineffect",
        type: "-string",
        restart: "Dock",
      },
      {
        path: ["dock", "show_recents"],
        domain: "com.apple.dock",
        key: "show-recents",
        type: "-bool",
        restart: "Dock",
      },
      {
        path: ["dock", "autohide_delay"],
        domain: "com.apple.dock",
        key: "autohide-delay",
        type: "-float",
        restart: "Dock",
      },
      {
        path: ["dock", "autohide_time"],
        domain: "com.apple.dock",
        key: "autohide-time-modifier",
        type: "-float",
        restart: "Dock",
      },
      // finder
      {
        path: ["finder", "show_hidden"],
        domain: "com.apple.finder",
        key: "AppleShowAllFiles",
        type: "-bool",
        restart: "Finder",
      },
      {
        path: ["finder", "show_path_bar"],
        domain: "com.apple.finder",
        key: "ShowPathbar",
        type: "-bool",
        restart: "Finder",
      },
      {
        path: ["finder", "show_status_bar"],
        domain: "com.apple.finder",
        key: "ShowStatusBar",
        type: "-bool",
        restart: "Finder",
      },
      {
        path: ["finder", "extension_change_warning"],
        domain: "com.apple.finder",
        key: "FXEnableExtensionChangeWarning",
        type: "-bool",
        restart: "Finder",
      },
      // keyboard
      {
        path: ["keyboard", "key_repeat"],
        domain: "NSGlobalDomain",
        key: "KeyRepeat",
        type: "-int",
        opts: { global: true },
        restart: "SystemUIServer",
      },
      {
        path: ["keyboard", "initial_key_repeat"],
        domain: "NSGlobalDomain",
        key: "InitialKeyRepeat",
        type: "-int",
        opts: { global: true },
        restart: "SystemUIServer",
      },
      {
        path: ["keyboard", "press_and_hold"],
        domain: "NSGlobalDomain",
        key: "ApplePressAndHoldEnabled",
        type: "-bool",
        opts: { global: true },
        restart: "SystemUIServer",
      },
      // screenshot
      {
        path: ["screenshot", "location"],
        domain: "com.apple.screencapture",
        key: "location",
        type: "-string",
        map: (v) => JSON.stringify(String(v)),
        restart: "SystemUIServer",
      },
      {
        path: ["screenshot", "type"],
        domain: "com.apple.screencapture",
        key: "type",
        type: "-string",
        restart: "SystemUIServer",
      },
      {
        path: ["screenshot", "disable_shadow"],
        domain: "com.apple.screencapture",
        key: "disable-shadow",
        type: "-bool",
        restart: "SystemUIServer",
      },
      // global
      {
        path: ["global", "auto_hide_menu_bar"],
        domain: "NSGlobalDomain",
        key: "_HIHideMenuBar",
        type: "-bool",
        opts: { global: true },
        restart: "SystemUIServer",
      },
      {
        path: ["global", "save_to_icloud_by_default"],
        domain: "NSGlobalDomain",
        key: "NSDocumentSaveNewDocumentsToCloud",
        type: "-bool",
        opts: { global: true },
        restart: "SystemUIServer",
      },
    ];

    for (const r of rules) {
      const v = this.getAt(this.cfg, r.path);
      if (v === undefined) continue;
      let valueStr: string;
      if (typeof r.map === "function") valueStr = r.map(v);
      else if (r.type === "-bool") valueStr = (v ? "true" : "false") as string;
      else valueStr = String(v);
      await this.defaultsWrite(ctx, r.domain, r.key, r.type, valueStr, r.opts);
      if (r.restart) restart.add(r.restart);
    }

    // Restart affected services to apply changes
    for (const svc of restart) await this.run(`killall ${svc} || true`, ctx);
  }

  render(): string {
    return `[macos] settings`;
  }
}

export function mac_settings(cfg: MacSettings, opts?: { plugin?: ShellPlugin }) {
  return new MacSettingsItem(cfg, opts?.plugin);
}
