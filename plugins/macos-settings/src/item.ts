import { Item, os as hostOS } from "@dot-steward/core";
import type { HostContext } from "@dot-steward/core";
import type { ItemPlan, ItemStatus } from "@dot-steward/core";
import { ShellPlugin } from "../../shell/src/plugin.ts";
import { MacSettingsSchema, type MacSettings } from "./schema.ts";
import type { CatalogRule, Rule, WriteType } from "./types.ts";
import { ALL_CATALOG } from "./catalog.ts";

// Item: applies macOS settings via `defaults write` + targeted restarts
export class MacSettingsItem extends Item {
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

  async probe(ctx: HostContext): Promise<ItemStatus> {
    // Compare desired vs current defaults; if no changes needed, mark as applied
    try {
      const changes = await this.computeChanges(ctx);
      this.set_status(changes === 0 ? "applied" : "pending");
    } catch {
      // On read errors, fall back to pending to allow apply to reconcile
      this.set_status("pending");
    }
    return this.state.status;
  }

  async validate(_ctx: HostContext): Promise<void> {
    // Validate config using Zod
    this.cfg = MacSettingsSchema.parse(this.cfg);
  }

  async plan(ctx: HostContext): Promise<ItemPlan | null> {
    const cats: string[] = [];
    if (this.cfg.mouse) cats.push("mouse");
    if (this.cfg.dock) cats.push("dock");
    if (this.cfg.finder) cats.push("finder");
    if (this.cfg.keyboard) cats.push("keyboard");
    if (this.cfg.screenshot) cats.push("screenshot");
    if (this.cfg.global) cats.push("global");
    if (this.cfg.defaults && this.cfg.defaults.length) cats.push("defaults");
    if (this.cfg.all && Object.keys(this.cfg.all).length) cats.push("all");
    const label = cats.length > 0 ? cats.join(", ") : "none";
    let changes = 0;
    try {
      changes = await this.computeChanges(ctx);
    } catch {
      // ignore and treat as changes unknown -> plan as update
      changes = 1;
    }
    if (changes > 0) return { summary: `[update] macOS settings (${label})` };
    // When no changes, manager will likely mark noop based on probe
    return { summary: `[noop] macOS settings (${label}) (in sync)` };
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
    const keyArg = JSON.stringify(key);
    const cmd = `defaults ${hostFlag}write ${domainArg} ${keyArg} ${type} ${value}`;
    await this.run(cmd, ctx);
  }

  private async defaultsRead(
    ctx: HostContext,
    domain: string,
    key: string,
    opts?: { global?: boolean; currentHost?: boolean },
  ): Promise<string | undefined> {
    const domainArg = opts?.global ? "-g" : domain;
    const hostFlag = opts?.currentHost ? "-currentHost " : "";
    const keyArg = JSON.stringify(key);
    const cmd = `defaults ${hostFlag}read ${domainArg} ${keyArg}`;
    const res = this.plugin
      ? await this.plugin.run(cmd, { shell: "sh", cwd: ctx.user.home ?? "." }, ctx)
      : await (await import("../../shell/src/exec.ts")).runShell(cmd, {
          shell: "sh",
          cwd: ctx.user.home ?? ".",
        });
    if (!res.ok) return undefined;
    return (res.stdout || "").trim();
  }

  private parseByType(type: WriteType, raw: string | undefined): unknown {
    if (raw === undefined) return undefined;
    const s = raw.trim();
    switch (type) {
      case "-bool": {
        const v = s.toLowerCase();
        return v === "1" || v === "true" || v === "yes" || v === "y";
      }
      case "-int": {
        const n = parseInt(s, 10);
        return Number.isFinite(n) ? n : undefined;
      }
      case "-float": {
        const n = parseFloat(s);
        return Number.isFinite(n) ? n : undefined;
      }
      case "-string":
      default:
        return s.replace(/^"|"$/g, "");
    }
  }

  private desiredParsed(rule: Rule, value: unknown): unknown {
    let out: string;
    if (typeof rule.map === "function") out = rule.map(value);
    else if (rule.type === "-bool") out = (value ? "true" : "false") as string;
    else if (rule.type === "-string") out = String(value);
    else out = String(value);
    // Convert write string to comparable parsed value by type
    if (rule.type === "-string") return String(value);
    if (rule.type === "-bool") return out === "true" || out === "1";
    if (rule.type === "-int") return Number.parseInt(out, 10);
    if (rule.type === "-float") return Number.parseFloat(out);
    return out;
  }

  private async computeChanges(ctx: HostContext): Promise<number> {
    let changes = 0;
    const consider = async (domain: string, key: string, type: WriteType, desired: unknown, opts?: { global?: boolean; currentHost?: boolean }) => {
      const currentRaw = await this.defaultsRead(ctx, domain, key, opts);
      const cur = this.parseByType(type, currentRaw);
      // For numbers, compare numerically; for strings/booleans, strict compare
      if (desired === undefined) return;
      if (type === "-float") {
        const d = typeof desired === "number" ? desired : Number(desired);
        const c = typeof cur === "number" ? cur : Number(cur);
        if (!Number.isFinite(c) || Math.abs(c - d) > 1e-6) changes++;
      } else if (type === "-int") {
        const d = typeof desired === "number" ? Math.trunc(desired) : Number.parseInt(String(desired), 10);
        const c = typeof cur === "number" ? Math.trunc(cur) : Number.parseInt(String(cur ?? NaN), 10);
        if (!Number.isFinite(c) || c !== d) changes++;
      } else {
        if (cur !== desired) changes++;
      }
    };

    // Specific rules driven by cfg.*
    const rules: Rule[] = [
      // mouse
      { path: ["mouse", "speed"], domain: "NSGlobalDomain", key: "com.apple.mouse.scaling", type: "-float", opts: { global: true } },
      { path: ["mouse", "natural_scrolling"], domain: "NSGlobalDomain", key: "com.apple.swipescrolldirection", type: "-bool", opts: { global: true } },
      { path: ["mouse", "tap_to_click"], domain: "com.apple.AppleMultitouchTrackpad", key: "Clicking", type: "-bool" },
      { path: ["mouse", "tap_to_click"], domain: "com.apple.driver.AppleBluetoothMultitouch.trackpad", key: "Clicking", type: "-bool" },
      { path: ["mouse", "tap_to_click"], domain: "NSGlobalDomain", key: "com.apple.mouse.tapBehavior", type: "-int", opts: { global: true, currentHost: true }, map: (v) => (v ? "1" : "0") },
      // dock
      { path: ["dock", "autohide"], domain: "com.apple.dock", key: "autohide", type: "-bool" },
      { path: ["dock", "tilesize"], domain: "com.apple.dock", key: "tilesize", type: "-int" },
      { path: ["dock", "magnification"], domain: "com.apple.dock", key: "magnification", type: "-bool" },
      { path: ["dock", "largesize"], domain: "com.apple.dock", key: "largesize", type: "-int" },
      { path: ["dock", "orientation"], domain: "com.apple.dock", key: "orientation", type: "-string" },
      { path: ["dock", "minimize_to_application"], domain: "com.apple.dock", key: "minimize-to-application", type: "-bool" },
      { path: ["dock", "mineffect"], domain: "com.apple.dock", key: "mineffect", type: "-string" },
      { path: ["dock", "show_recents"], domain: "com.apple.dock", key: "show-recents", type: "-bool" },
      { path: ["dock", "autohide_delay"], domain: "com.apple.dock", key: "autohide-delay", type: "-float" },
      { path: ["dock", "autohide_time"], domain: "com.apple.dock", key: "autohide-time-modifier", type: "-float" },
      // finder
      { path: ["finder", "show_hidden"], domain: "com.apple.finder", key: "AppleShowAllFiles", type: "-bool" },
      { path: ["finder", "show_path_bar"], domain: "com.apple.finder", key: "ShowPathbar", type: "-bool" },
      { path: ["finder", "show_status_bar"], domain: "com.apple.finder", key: "ShowStatusBar", type: "-bool" },
      { path: ["finder", "extension_change_warning"], domain: "com.apple.finder", key: "FXEnableExtensionChangeWarning", type: "-bool" },
      // keyboard
      { path: ["keyboard", "key_repeat"], domain: "NSGlobalDomain", key: "KeyRepeat", type: "-int", opts: { global: true } },
      { path: ["keyboard", "initial_key_repeat"], domain: "NSGlobalDomain", key: "InitialKeyRepeat", type: "-int", opts: { global: true } },
      { path: ["keyboard", "press_and_hold"], domain: "NSGlobalDomain", key: "ApplePressAndHoldEnabled", type: "-bool", opts: { global: true } },
      // screenshot
      { path: ["screenshot", "location"], domain: "com.apple.screencapture", key: "location", type: "-string" },
      { path: ["screenshot", "type"], domain: "com.apple.screencapture", key: "type", type: "-string" },
      { path: ["screenshot", "disable_shadow"], domain: "com.apple.screencapture", key: "disable-shadow", type: "-bool" },
      // global
      { path: ["global", "auto_hide_menu_bar"], domain: "NSGlobalDomain", key: "_HIHideMenuBar", type: "-bool", opts: { global: true } },
      { path: ["global", "save_to_icloud_by_default"], domain: "NSGlobalDomain", key: "NSDocumentSaveNewDocumentsToCloud", type: "-bool", opts: { global: true } },
    ];

    for (const r of rules) {
      const raw = this.getAt(this.cfg, r.path);
      if (raw === undefined) continue;
      const desired = this.desiredParsed(r, raw);
      await consider(r.domain, r.key, r.type, desired, r.opts);
    }

    if (this.cfg.defaults) {
      for (const d of this.cfg.defaults) {
        let desired: unknown;
        switch (d.type) {
          case "-bool":
            desired = !!d.value;
            break;
          case "-int":
            desired = Math.trunc(Number(d.value));
            break;
          case "-float":
            desired = Number(d.value);
            break;
          case "-string":
          default:
            desired = String(d.value);
        }
        await consider(d.domain, d.key, d.type, desired, d.opts);
      }
    }

    if (this.cfg.all) {
      for (const [category, kv] of Object.entries(this.cfg.all)) {
        const cat = (ALL_CATALOG as any)[category];
        if (!cat) continue;
        for (const [key, raw] of Object.entries(kv as Record<string, unknown>)) {
          let rule = (cat as any)[key] as CatalogRule | CatalogRule[] | undefined;
          if (!rule) continue;
          const rules = Array.isArray(rule) ? rule : [rule];
          for (const rr of rules) {
            let desired: unknown;
            if (typeof rr.map === "function") {
              // map returns string for write; coerce by type below
              const mapped = rr.map(raw);
              if (rr.type === "-bool") desired = mapped === "true" || mapped === "1";
              else if (rr.type === "-int") desired = Number.parseInt(mapped, 10);
              else if (rr.type === "-float") desired = Number.parseFloat(mapped);
              else desired = String(raw);
            } else {
              if (rr.type === "-bool") desired = !!raw;
              else if (rr.type === "-int") desired = Math.trunc(Number(raw));
              else if (rr.type === "-float") desired = Number(raw);
              else desired = String(raw);
            }
            for (const domain of rr.domains) {
              await consider(domain, rr.key, rr.type, desired, rr.opts);
            }
          }
        }
      }
    }

    return changes;
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
      else if (r.type === "-string") valueStr = JSON.stringify(String(v));
      else valueStr = String(v);
      await this.defaultsWrite(ctx, r.domain, r.key, r.type, valueStr, r.opts);
      if (r.restart) restart.add(r.restart);
    }

    // Apply generic passthrough defaults writes (from ALL.md)
    if (this.cfg.defaults) {
      for (const d of this.cfg.defaults) {
        let valueStr: string;
        switch (d.type) {
          case "-bool":
            valueStr = d.value ? "true" : "false";
            break;
          case "-int":
            valueStr = String(Math.trunc(d.value as number));
            break;
          case "-float":
            valueStr = String(d.value);
            break;
          case "-string":
            valueStr = JSON.stringify(String(d.value));
            break;
        }
        await this.defaultsWrite(ctx, d.domain, d.key, d.type, valueStr, d.opts);
        if (d.restart) restart.add(d.restart);
      }
    }

    // Apply catalog-driven settings under cfg.all
    if (this.cfg.all) {
      for (const [category, kv] of Object.entries(this.cfg.all)) {
        const cat = (ALL_CATALOG as any)[category];
        if (!cat) throw new Error(`Unknown ALL.md category: ${category}`);
        for (const [key, raw] of Object.entries(kv as Record<string, unknown>)) {
          let rule = (cat as any)[key] as CatalogRule | CatalogRule[] | undefined;
          if (!rule) throw new Error(`Unknown key in ${category}: ${key}`);
          const rules = Array.isArray(rule) ? rule : [rule];
          for (const r of rules) {
            // Map value to proper string by type
            let valueStr: string;
            if (typeof r.map === "function") valueStr = r.map(raw);
            else if (r.type === "-bool") valueStr = (raw ? "true" : "false") as string;
            else if (r.type === "-string") valueStr = JSON.stringify(String(raw));
            else if (r.type === "-int") valueStr = String(Math.trunc(Number(raw)));
            else valueStr = String(Number(raw)); // -float
            for (const domain of r.domains) {
              await this.defaultsWrite(ctx, domain, r.key, r.type, valueStr, r.opts);
            }
            if (r.restart) restart.add(r.restart);
          }
        }
      }
    }

    // Restart affected services to apply changes
    for (const svc of restart) await this.run(`killall ${svc} || true`, ctx);
  }

  render(): string {
    return `[macos] settings`;
  }
}
