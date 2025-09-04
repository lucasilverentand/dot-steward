import { Item } from "@dot-steward/core";
import type { HostContext } from "@dot-steward/core";
import type { ItemPlan, ItemStatus } from "@dot-steward/core";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { ConfigPlugin } from "./plugin.ts";

type Format = "json" | "yaml" | "toml" | "raw";

export type ConfigFileOptions = {
  vars?: Record<string, unknown>;
  mode?: number; // unix permission bits, e.g. 0o644
};

export class ConfigFile extends Item {
  readonly plugin?: ConfigPlugin;
  readonly plugin_key = "config";
  readonly matches = { type: "any", of: [{ type: "os", values: ["linux", "darwin", "win32"] }] } as const;

  constructor(
    readonly filePath: string,
    readonly format: Format,
    readonly source: unknown,
    readonly opts?: ConfigFileOptions,
    dep?: ConfigPlugin,
  ) {
    super({ kind: `config:file`, requires: dep ? [dep.id] : [] });
    this.plugin = dep;
  }

  get_plugin_factory(): ConfigPlugin {
    return new ConfigPlugin();
  }

  render(): string {
    // Render with a home-based default to hint at the target
    const home = process.env.HOME ?? os.homedir();
    const base = path.isAbsolute(this.filePath)
      ? this.filePath
      : home
        ? path.join(home, this.filePath)
        : path.join(process.cwd(), this.filePath);
    return `[config:${this.format}] ${base}`;
  }

  async probe(ctx: HostContext): Promise<ItemStatus> {
    // If file exists and content matches, mark applied; otherwise pending
    const desired = await this.renderContent();
    const abs = resolveTargetPath(this.filePath, ctx);
    try {
      const cur = await fs.readFile(abs, "utf8");
      const same = normalizeEOL(cur) === normalizeEOL(desired);
      this.set_status(same ? "applied" : "pending");
    } catch {
      this.set_status("pending");
    }
    return this.state.status;
  }

  async validate(_ctx: HostContext): Promise<void> {
    if (typeof this.filePath !== "string" || this.filePath.length === 0)
      throw new Error("config:file requires a non-empty path");
    if (!isSupportedFormat(this.format))
      throw new Error(`unsupported config format: ${this.format}`);
    // Validate source shape for structured formats
    if (this.format !== "raw") {
      if (!isStructured(this.source))
        throw new Error(
          `config:${this.format} requires object/array as data source`,
        );
    } else {
      if (!isTextual(this.source))
        throw new Error("config:raw requires string or string[] source");
    }
  }

  async plan(ctx: HostContext): Promise<ItemPlan | null> {
    const abs = resolveTargetPath(this.filePath, ctx);
    let note = "create";
    try {
      const desired = await this.renderContent();
      const cur = await fs.readFile(abs, "utf8");
      note = normalizeEOL(cur) === normalizeEOL(desired) ? "noop" : "update";
    } catch {
      note = "create";
    }
    return { summary: `${this.format} ${abs} (${note})` };
  }

  async apply(ctx: HostContext): Promise<void> {
    const abs = resolveTargetPath(this.filePath, ctx);
    const dir = path.dirname(abs);
    await fs.mkdir(dir, { recursive: true });
    const body = await this.renderContent();
    await fs.writeFile(abs, body, "utf8");
    if (typeof this.opts?.mode === "number") {
      try {
        await fs.chmod(abs, this.opts.mode);
      } catch {
        // ignore on platforms that don't support chmod
      }
    }
  }

  private async renderContent(): Promise<string> {
    const vars = this.opts?.vars ?? {};
    switch (this.format) {
      case "json":
        return serializeJSON(applyVars(this.source, vars));
      case "yaml":
        return serializeYAML(applyVars(this.source, vars));
      case "toml":
        return serializeTOML(applyVars(this.source, vars));
      case "raw":
        return serializeRaw(this.source, vars);
    }
  }
}

function normalizeEOL(s: string): string {
  return s.replace(/\r\n/g, "\n");
}

function isSupportedFormat(f: string): f is Format {
  return f === "json" || f === "yaml" || f === "toml" || f === "raw";
}

function isStructured(v: unknown): v is object | unknown[] {
  return typeof v === "object" && v !== null;
}
function isTextual(v: unknown): v is string | string[] {
  return typeof v === "string" || (Array.isArray(v) && v.every((x) => typeof x === "string"));
}

// Variable interpolation utilities
function applyVars(input: unknown, vars: Record<string, unknown>): unknown {
  if (typeof input === "string") return interpolate(input, vars);
  if (Array.isArray(input)) return input.map((v) => applyVars(v, vars));
  if (typeof input === "object" && input) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) out[k] = applyVars(v, vars);
    return out;
  }
  return input;
}

function interpolate(s: string, vars: Record<string, unknown>): string {
  return s.replace(/\$\{([a-zA-Z0-9_\.]+)\}/g, (_m, key) => {
    const val = getVar(vars, key);
    return val === undefined || val === null ? "" : String(val);
  });
}

function getVar(obj: Record<string, unknown>, pathStr: string): unknown {
  const parts = pathStr.split(".");
  let cur: any = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = cur[p];
  }
  return cur;
}

// Serializers (minimal, covering common cases)
function serializeJSON(data: unknown): string {
  return JSON.stringify(data, null, 2) + "\n";
}

function serializeRaw(data: unknown, vars: Record<string, unknown>): string {
  if (typeof data === "string") return interpolate(data, vars) + (data.endsWith("\n") ? "" : "\n");
  if (Array.isArray(data)) return data.map((l) => interpolate(String(l), vars)).join("\n") + "\n";
  return String(data) + "\n";
}

// Basic YAML (strings, numbers, booleans, arrays, objects)
function serializeYAML(data: unknown): string {
  const lines: string[] = [];
  const emit = (val: unknown, indent = 0) => {
    const pad = " ".repeat(indent);
    if (val === null || val === undefined) {
      lines.push(pad + "null");
    } else if (typeof val === "string") {
      if (/^[A-Za-z0-9_\-\.\/:]+$/.test(val)) lines.push(pad + val);
      else lines.push(pad + JSON.stringify(val));
    } else if (typeof val === "number" || typeof val === "bigint") {
      lines.push(pad + String(val));
    } else if (typeof val === "boolean") {
      lines.push(pad + (val ? "true" : "false"));
    } else if (Array.isArray(val)) {
      if (val.length === 0) {
        lines.push(pad + "[]");
      } else {
        for (const item of val) {
          if (isScalar(item)) {
            // inline scalar list items
            const buf: string[] = [];
            const before = lines.length;
            emit(item, 0);
            buf.push(lines.pop() as string);
            lines.push(pad + "- " + buf[0].trim());
          } else {
            lines.push(pad + "-");
            emit(item, indent + 2);
          }
        }
      }
    } else if (typeof val === "object") {
      const obj = val as Record<string, unknown>;
      const keys = Object.keys(obj);
      if (keys.length === 0) {
        lines.push(pad + "{}");
      } else {
        for (const k of keys) {
          const v = obj[k];
          if (isScalar(v)) {
            const buf: string[] = [];
            const before = lines.length;
            emit(v, 0);
            buf.push(lines.pop() as string);
            lines.push(pad + `${k}: ` + buf[0].trim());
          } else if (Array.isArray(v) && v.length === 0) {
            lines.push(pad + `${k}: []`);
          } else if (v && typeof v === "object" && Object.keys(v as any).length === 0) {
            lines.push(pad + `${k}: {}`);
          } else {
            lines.push(pad + `${k}:`);
            emit(v, indent + 2);
          }
        }
      }
    }
  };
  emit(data, 0);
  return lines.join("\n") + "\n";
}

function isScalar(v: unknown): boolean {
  return (
    v === null ||
    v === undefined ||
    typeof v === "string" ||
    typeof v === "number" ||
    typeof v === "bigint" ||
    typeof v === "boolean"
  );
}

// Simple TOML serializer for common shapes: primitives, arrays of primitives, nested tables.
function serializeTOML(data: unknown): string {
  const lines: string[] = [];
  const ctx: string[] = [];

  const emitKV = (k: string, v: unknown) => {
    const key = tomlKey(k);
    if (typeof v === "string") lines.push(`${key} = ${tomlString(v)}`);
    else if (typeof v === "number" || typeof v === "bigint") lines.push(`${key} = ${String(v)}`);
    else if (typeof v === "boolean") lines.push(`${key} = ${v ? "true" : "false"}`);
    else if (Array.isArray(v)) {
      if (v.every(isPrimitive)) {
        lines.push(`${key} = [ ${v.map(tomlPrimitive).join(", ")} ]`);
      } else {
        // arrays of objects unsupported in this minimal serializer
        lines.push(`# unsupported complex array for key '${key}'`);
      }
    } else if (v && typeof v === "object") {
      // Nested table
      ctx.push(k);
      lines.push("");
      lines.push(`[${ctx.map(tomlKey).join(".")}]`);
      emitTable(v as Record<string, unknown>);
      ctx.pop();
    } else if (v === null || v === undefined) {
      lines.push(`${key} = ""`);
    }
  };

  const emitTable = (obj: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(obj)) emitKV(k, v);
  };

  if (data && typeof data === "object" && !Array.isArray(data)) {
    emitTable(data as Record<string, unknown>);
  } else {
    lines.push(`# root must be a table/object for TOML`);
  }
  // Ensure trailing newline
  if (lines.length === 0 || lines[lines.length - 1] !== "") lines.push("");
  return lines.join("\n");
}

function tomlKey(k: string): string {
  return /^[A-Za-z0-9_\-]+$/.test(k) ? k : JSON.stringify(k);
}
function tomlString(s: string): string {
  // basic escaping via JSON stringifier
  return JSON.stringify(s);
}
function isPrimitive(v: unknown): boolean {
  return (
    typeof v === "string" ||
    typeof v === "number" ||
    typeof v === "bigint" ||
    typeof v === "boolean"
  );
}

// Merge utility for SDK
export function deepMerge<T extends unknown[]>(...parts: T): any {
  const mergeTwo = (a: any, b: any): any => {
    if (Array.isArray(a) && Array.isArray(b)) return b.slice(); // replace arrays
    if (isPlain(a) && isPlain(b)) {
      const out: Record<string, unknown> = { ...a };
      for (const [k, v] of Object.entries(b)) {
        if (k in out) out[k] = mergeTwo((out as any)[k], v);
        else out[k] = v;
      }
      return out;
    }
    return b;
  };
  return parts.reduce((acc, cur) => mergeTwo(acc, cur));
}

function isPlain(v: unknown): v is Record<string, unknown> {
  return (
    typeof v === "object" &&
    v !== null &&
    !Array.isArray(v) &&
    Object.getPrototypeOf(v) === Object.prototype
  );
}
function resolveTargetPath(p: string, ctx: HostContext): string {
  if (path.isAbsolute(p)) return p;
  const home = ctx.user.home ?? process.env.HOME ?? os.homedir();
  const base = home ?? process.cwd();
  return path.resolve(base, p);
}

