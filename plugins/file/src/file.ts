import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Item } from "@dot-steward/core";
import type { HostContext } from "@dot-steward/core";
import type { ItemPlan, ItemStatus } from "@dot-steward/core";
import { FilePlugin } from "./plugin.ts";

type Format = "json" | "yaml" | "toml" | "raw";

export type FileOptions = {
  vars?: Record<string, unknown>;
  mode?: number; // unix permission bits, e.g. 0o644
};

// Write content generated from structured data or text
export class FileContent extends Item {
  readonly plugin?: FilePlugin;
  readonly plugin_key = "file";
  readonly matches = {
    type: "any",
    of: [{ type: "os", values: ["linux", "darwin", "win32"] }],
  } as const;

  constructor(
    readonly filePath: string,
    readonly format: Format,
    readonly source: unknown,
    readonly opts?: FileOptions,
    dep?: FilePlugin,
  ) {
    super({ kind: "file:content", requires: dep ? [dep.id] : [] });
    this.plugin = dep;
  }

  get_plugin_factory(): FilePlugin {
    return new FilePlugin();
  }

  render(): string {
    const base = path.isAbsolute(this.filePath)
      ? this.filePath
      : `~/${this.filePath.replace(/^\/?/, "")}`;
    return base;
  }

  async probe(ctx: HostContext): Promise<ItemStatus> {
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
      throw new Error("file:content requires a non-empty path");
    if (!isSupportedFormat(this.format))
      throw new Error(`unsupported file format: ${this.format}`);
    if (this.format !== "raw") {
      if (!isStructured(this.source))
        throw new Error(
          `file:${this.format} requires object/array as data source`,
        );
    } else {
      if (!isTextual(this.source))
        throw new Error("file:raw requires string or string[] source");
    }
  }

  async plan(ctx: HostContext): Promise<ItemPlan | null> {
    const abs = resolveTargetPath(this.filePath, ctx);
    // For plan preview, just render the destination path
    // The action symbol (+/-) communicates create/update/noop already.
    try {
      const desired = await this.renderContent();
      const cur = await fs.readFile(abs, "utf8");
      // still probe to establish status, but don't include in summary
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      normalizeEOL(cur) === normalizeEOL(desired);
    } catch {
      // ignore
    }
    return { summary: `${abs}` };
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

// Copy a file verbatim from a source path to a destination path.
export class CopyFile extends Item {
  readonly plugin?: FilePlugin;
  readonly plugin_key = "file";
  readonly matches = {
    type: "any",
    of: [{ type: "os", values: ["linux", "darwin", "win32"] }],
  } as const;

  constructor(
    readonly srcPath: string,
    readonly destPath: string,
    readonly mode?: number,
    dep?: FilePlugin,
  ) {
    super({ kind: "file:copy", requires: dep ? [dep.id] : [] });
    this.plugin = dep;
  }

  get_plugin_factory(): FilePlugin {
    return new FilePlugin();
  }

  render(): string {
    const dest = this.destPath;
    const base = path.isAbsolute(dest) ? dest : `~/${dest.replace(/^\/?/, "")}`;
    return base;
  }

  async probe(ctx: HostContext): Promise<ItemStatus> {
    const srcAbs = resolveSourcePath(this.srcPath);
    const destAbs = resolveTargetPath(this.destPath, ctx);
    try {
      const [src, dest] = await Promise.all([
        fs.readFile(srcAbs),
        fs.readFile(destAbs),
      ]);
      const same = src.byteLength === dest.byteLength && src.equals(dest);
      this.set_status(same ? "applied" : "pending");
    } catch {
      this.set_status("pending");
    }
    return this.state.status;
  }

  async validate(_ctx: HostContext): Promise<void> {
    if (typeof this.srcPath !== "string" || this.srcPath.length === 0)
      throw new Error("file:copy requires a non-empty srcPath");
    if (typeof this.destPath !== "string" || this.destPath.length === 0)
      throw new Error("file:copy requires a non-empty destPath");
    const srcAbs = resolveSourcePath(this.srcPath);
    try {
      const st = await fs.stat(srcAbs);
      if (!st.isFile()) throw new Error();
    } catch {
      throw new Error(`file:copy source not found or not a file: ${srcAbs}`);
    }
  }

  async plan(ctx: HostContext): Promise<ItemPlan | null> {
    const srcAbs = resolveSourcePath(this.srcPath);
    const destAbs = resolveTargetPath(this.destPath, ctx);
    // For plan preview, just render the destination path
    try {
      const [src, dest] = await Promise.all([
        fs.readFile(srcAbs),
        fs.readFile(destAbs),
      ]);
      // establish status but keep summary minimal
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      src.equals(dest);
    } catch {
      // ignore
    }
    return { summary: `${destAbs}` };
  }

  async apply(ctx: HostContext): Promise<void> {
    const srcAbs = resolveSourcePath(this.srcPath);
    const destAbs = resolveTargetPath(this.destPath, ctx);
    const dir = path.dirname(destAbs);
    await fs.mkdir(dir, { recursive: true });
    const buf = await fs.readFile(srcAbs);
    await fs.writeFile(destAbs, buf);
    if (typeof this.mode === "number") {
      try {
        await fs.chmod(destAbs, this.mode);
      } catch {
        // ignore on platforms that don't support chmod
      }
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
  return (
    typeof v === "string" ||
    (Array.isArray(v) && v.every((x) => typeof x === "string"))
  );
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
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur === null || typeof cur !== "object") return undefined;
    const rec = cur as Record<string, unknown>;
    cur = rec[p];
  }
  return cur;
}

// Serializers (minimal, covering common cases)
function serializeJSON(data: unknown): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}

function serializeRaw(data: unknown, vars: Record<string, unknown>): string {
  if (typeof data === "string")
    return interpolate(data, vars) + (data.endsWith("\n") ? "" : "\n");
  if (Array.isArray(data))
    return `${data.map((l) => interpolate(String(l), vars)).join("\n")}\n`;
  return `${String(data)}\n`;
}

// Basic YAML (strings, numbers, booleans, arrays, objects)
function serializeYAML(data: unknown): string {
  const lines: string[] = [];
  const emit = (val: unknown, indent = 0) => {
    const pad = " ".repeat(indent);
    if (val === null || val === undefined) {
      lines.push(`${pad}null`);
    } else if (typeof val === "string") {
      if (/^[A-Za-z0-9_\-\.\/:]+$/.test(val)) lines.push(pad + val);
      else lines.push(pad + JSON.stringify(val));
    } else if (typeof val === "number" || typeof val === "bigint") {
      lines.push(pad + String(val));
    } else if (typeof val === "boolean") {
      lines.push(pad + (val ? "true" : "false"));
    } else if (Array.isArray(val)) {
      if (val.length === 0) {
        lines.push(`${pad}[]`);
      } else {
        for (const item of val) {
          if (isScalar(item)) {
            const buf: string[] = [];
            emit(item, 0);
            buf.push(lines.pop() as string);
            lines.push(`${pad}- ${buf[0].trim()}`);
          } else {
            lines.push(`${pad}-`);
            emit(item, indent + 2);
          }
        }
      }
    } else if (typeof val === "object") {
      const obj = val as Record<string, unknown>;
      const keys = Object.keys(obj);
      if (keys.length === 0) {
        lines.push(`${pad}{}`);
      } else {
        for (const k of keys) {
          const v = obj[k];
          if (isScalar(v)) {
            const buf: string[] = [];
            emit(v, 0);
            buf.push(lines.pop() as string);
            lines.push(`${pad}${k}: ${buf[0].trim()}`);
          } else if (Array.isArray(v) && v.length === 0) {
            lines.push(`${pad}${k}: []`);
          } else if (
            v &&
            typeof v === "object" &&
            Object.keys(v as Record<string, unknown>).length === 0
          ) {
            lines.push(`${pad}${k}: {}`);
          } else {
            lines.push(`${pad}${k}:`);
            emit(v, indent + 2);
          }
        }
      }
    }
  };
  emit(data, 0);
  return `${lines.join("\n")}\n`;
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
    else if (typeof v === "number" || typeof v === "bigint")
      lines.push(`${key} = ${String(v)}`);
    else if (typeof v === "boolean")
      lines.push(`${key} = ${v ? "true" : "false"}`);
    else if (Array.isArray(v)) {
      if (v.every(isPrimitive)) {
        lines.push(`${key} = [ ${v.map(tomlPrimitive).join(", ")} ]`);
      } else {
        lines.push(`# unsupported complex array for key '${key}'`);
      }
    } else if (v && typeof v === "object") {
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
    lines.push("# root must be a table/object for TOML");
  }
  if (lines.length === 0 || lines[lines.length - 1] !== "") lines.push("");
  return lines.join("\n");
}

function tomlKey(k: string): string {
  return /^[A-Za-z0-9_\-]+$/.test(k) ? k : JSON.stringify(k);
}
function tomlString(s: string): string {
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

function tomlPrimitive(v: unknown): string {
  if (typeof v === "string") return tomlString(v);
  if (typeof v === "number" || typeof v === "bigint") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return tomlString(String(v));
}

function isPlain(v: unknown): v is Record<string, unknown> {
  return (
    typeof v === "object" &&
    v !== null &&
    !Array.isArray(v) &&
    Object.getPrototypeOf(v) === Object.prototype
  );
}

export function deepMerge(
  ...parts: Array<Record<string, unknown>>
): Record<string, unknown> {
  const mergeTwo = (a: unknown, b: unknown): unknown => {
    if (Array.isArray(a) && Array.isArray(b)) return b.slice(); // replace arrays
    if (isPlain(a) && isPlain(b)) {
      const out: Record<string, unknown> = {
        ...(a as Record<string, unknown>),
      };
      for (const [k, v] of Object.entries(b as Record<string, unknown>)) {
        if (k in out) out[k] = mergeTwo(out[k], v) as unknown;
        else out[k] = v;
      }
      return out;
    }
    return b;
  };
  let acc: unknown = {};
  for (const cur of parts) acc = mergeTwo(acc, cur);
  return (isPlain(acc) ? acc : {}) as Record<string, unknown>;
}

function resolveTargetPath(p: string, ctx: HostContext): string {
  if (path.isAbsolute(p)) return p;
  const home = ctx.user.home;
  if (!home)
    throw new Error(
      "file:content cannot resolve relative path: HostContext.user.home is missing",
    );
  return path.resolve(home, p);
}

function resolveSourcePath(p: string): string {
  if (path.isAbsolute(p)) return p;
  return path.resolve(process.cwd(), p);
}
