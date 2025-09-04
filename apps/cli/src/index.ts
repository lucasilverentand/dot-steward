import { DotFileManager, computePlanHash, HostContext } from "@dot-steward/core";
import type { ManagerConfig } from "@dot-steward/core";
import type { AnalyzeReport, Plan, ApplyReport, ActionNode } from "@dot-steward/core";
import { pathToFileURL } from "node:url";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import pc from "picocolors";

type Args = {
  cmd: "analyze" | "plan" | "apply" | "help";
  config?: string;
  out?: string;
  plan?: string;
  json?: boolean;
};

function parseArgs(argv: string[]): Args {
  const out: Args = { cmd: (argv[0] as Args["cmd"]) || "help" };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "-c":
      case "--config":
        out.config = argv[++i];
        break;
      case "-o":
      case "--out":
        out.out = argv[++i];
        break;
      case "-p":
      case "--plan":
        out.plan = argv[++i];
        break;
      case "--json":
        out.json = true;
        break;
      case "analyze":
      case "plan":
      case "apply":
        out.cmd = a;
        break;
      default:
        // ignore unknowns for now
        break;
    }
  }
  return out;
}

async function loadConfig(configPath: string): Promise<ManagerConfig> {
  const abs = path.isAbsolute(configPath)
    ? configPath
    : path.join(process.cwd(), configPath);
  const mod = await import(pathToFileURL(abs).href);
  const cfg: unknown = mod.default ?? mod.config ?? mod;
  // Minimal validation
  if (!cfg || typeof cfg !== "object" || !("profiles" in (cfg as Record<string, unknown>))) {
    throw new Error(`Invalid config at ${abs}: missing default export with profiles`);
  }
  return cfg as ManagerConfig;
}

function writeJson(file: string, data: unknown) {
  const abs = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(data, null, 2));
}

function readJson<T>(file: string): T {
  const abs = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
  const text = fs.readFileSync(abs, "utf8");
  return JSON.parse(text) as T;
}

// Workspace state (.dot-steward)
function stateRoot(): string {
  const dir = path.join(process.cwd(), ".dot-steward");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function latestAppliesFile(): string | undefined {
  const root = stateRoot();
  const dir = path.join(root, "applies");
  if (!fs.existsSync(dir)) return undefined;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("apply-") && f.endsWith(".json"))
    .sort();
  if (files.length === 0) return undefined;
  return path.join(dir, files[files.length - 1]!);
}

function savePlanToState(plan: Plan) {
  const root = stateRoot();
  // Latest plan
  writeJson(path.join(root, "plan.json"), plan);
  // Historical copy by hash
  const plansDir = path.join(root, "plans");
  fs.mkdirSync(plansDir, { recursive: true });
  writeJson(path.join(plansDir, `${plan.hash}.json`), plan);
}

function saveApplyToState(plan: Plan, report: ApplyReport) {
  const root = stateRoot();
  const appliesDir = path.join(root, "applies");
  fs.mkdirSync(appliesDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:]/g, "-");
  writeJson(path.join(appliesDir, `apply-${ts}.json`), { plan, report });
  // Latest snapshots
  writeJson(path.join(root, "apply.json"), report);
  const ok = report.results.filter((x) => x.status === "ok").length;
  const skipped = report.results.filter((x) => x.status === "skipped").length;
  const failed = report.results.filter((x) => x.status === "failed").length;
  const inventory = plan.nodes
    .filter((n) => n.action !== "destroy")
    .map((n) => ({ itemId: n.itemId, pluginId: n.pluginId, capabilityId: n.capabilityId, kind: (n.metadata as any)?.kind as string | undefined }));
  // Persist a compact dependency map (itemId -> string[] of deps)
  const deps: Record<string, string[]> = {};
  for (const e of plan.edges) {
    if (e.type !== "dep") continue;
    // map node ids back to item ids
    const fromItem = e.from.startsWith("node:") ? e.from.slice("node:".length) : e.from;
    const toItem = e.to.startsWith("node:") ? e.to.slice("node:".length) : e.to;
    deps[toItem] = [...(deps[toItem] ?? []), fromItem];
  }
  writeJson(path.join(root, "state.json"), {
    lastApplyAt: new Date().toISOString(),
    planHash: plan.hash,
    nodes: plan.nodes.length,
    edges: plan.edges.length,
    summary: { ok, skipped, failed },
    items: inventory,
    deps,
  });
}

type InventoryItem = { itemId: string; pluginId?: string; capabilityId?: string; kind?: string };
function loadInventoryFromState(): Map<string, InventoryItem> | undefined {
  // Prefer compact state inventory
  try {
    const root = stateRoot();
    const s = path.join(root, "state.json");
    if (fs.existsSync(s)) {
      const state = readJson<{ items?: unknown }>(s);
      const items = state.items;
      if (Array.isArray(items)) {
        if (items.length === 0) return new Map();
        if (typeof items[0] === "string") {
          // backward-compat: simple list of ids
          return new Map((items as string[]).map((id) => [id, { itemId: id }] as const));
        }
        // object form
        const typed = (items as any[]).map((x) => ({
          itemId: String(x.itemId ?? x.id),
          pluginId: x.pluginId ? String(x.pluginId) : undefined,
          capabilityId: x.capabilityId ? String(x.capabilityId) : undefined,
          kind: x.kind ? String(x.kind) : undefined,
        })) as InventoryItem[];
        return new Map(typed.map((it) => [it.itemId, it] as const));
      }
    }
  } catch {}
  // Fallback to latest applies record containing a plan
  try {
    const latest = latestAppliesFile();
    if (latest && fs.existsSync(latest)) {
      const payload = readJson<{ plan?: Plan }>(latest);
      const plan = payload.plan;
      if (plan && plan.nodes) {
        const items = plan.nodes
          .filter((n) => n.action !== "destroy")
          .map((n) => ({ itemId: n.itemId, pluginId: n.pluginId, capabilityId: n.capabilityId, kind: (n.metadata as any)?.kind as string | undefined }));
        return new Map(items.map((it) => [it.itemId, it] as const));
      }
    }
  } catch {}
  return undefined;
}

type DepsMap = Map<string, string[]>;

function loadPrevDepsFromState(): DepsMap | undefined {
  try {
    const root = stateRoot();
    const s = path.join(root, "state.json");
    if (fs.existsSync(s)) {
      const state = readJson<{ deps?: Record<string, string[]> }>(s);
      const rec = state.deps;
      if (rec && typeof rec === "object") {
        return new Map(Object.entries(rec).map(([k, v]) => [String(k), Array.isArray(v) ? v.map(String) : []] as const));
      }
    }
  } catch {}
  // Fallback to latest apply plan
  try {
    const latest = latestAppliesFile();
    if (latest && fs.existsSync(latest)) {
      const payload = readJson<{ plan?: Plan }>(latest);
      const plan = payload.plan;
      if (plan && Array.isArray(plan.edges)) {
        const deps = new Map<string, string[]>();
        for (const e of plan.edges) {
          if (e.type !== "dep") continue;
          const fromItem = e.from.startsWith("node:") ? e.from.slice("node:".length) : e.from;
          const toItem = e.to.startsWith("node:") ? e.to.slice("node:".length) : e.to;
          deps.set(toItem, [...(deps.get(toItem) ?? []), fromItem]);
        }
        return deps;
      }
    }
  } catch {}
  return undefined;
}

function augmentWithDestroys(current: Plan): Plan {
  const prev = loadInventoryFromState();
  if (!prev) return current;
  const currItems = new Set(current.nodes.map((n) => n.itemId));
  const toDestroy = Array.from(prev.keys()).filter((id) => !currItems.has(id));
  if (toDestroy.length === 0) return current;

  const destroyNodes: ActionNode[] = [];
  for (const id of toDestroy) {
    destroyNodes.push({
      id: `node:${id}:destroy`,
      itemId: id,
      pluginId: prev.get(id)?.pluginId,
      capabilityId: prev.get(id)?.capabilityId,
      action: "destroy",
      state: undefined,
      locks: [],
      metadata: { kind: prev.get(id)?.kind ?? "unknown" },
    });
  }
  // Build dependency edges among destroy nodes from previously persisted deps
  const prevDeps = loadPrevDepsFromState();
  const destroySet = new Set(toDestroy);
  const newEdges: Plan["edges"] = [];
  if (prevDeps) {
    for (const item of toDestroy) {
      const deps = prevDeps.get(item) ?? [];
      for (const dep of deps) {
        if (destroySet.has(dep)) {
          // Maintain same orientation (dep -> item) for destr nodes
          newEdges.push({ from: `node:${dep}:destroy`, to: `node:${item}:destroy`, type: "dep" });
        }
      }
    }
  }
  const merged: Plan = {
    ...current,
    nodes: [...current.nodes, ...destroyNodes],
    edges: [...current.edges, ...newEdges],
  };
  // Recompute hash to reflect appended destroys (ignoring createdAt)
  merged.hash = computePlanHash({
    header: merged.header,
    nodes: merged.nodes,
    edges: merged.edges,
  });
  return merged;
}

async function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  if (args.cmd === "help" || (!args.config && args.cmd !== "apply")) {
    console.log(`Usage:
  dot-steward analyze -c <config.ts>
  dot-steward plan -c <config.ts> [-o plan.json]
  dot-steward apply -c <config.ts> | -p <plan.json>`);
    process.exit(args.cmd === "help" ? 0 : 1);
  }

  try {
    if (args.cmd === "analyze") {
      const cfg = await loadConfig(args.config!);
      // Do not probe or initialize host for analyze; just render config as-is
      const summary = buildConfigSummary(cfg);
      if (args.json) {
        console.log(JSON.stringify(summary, null, 2));
      } else {
        renderConfigSummary(summary);
      }
      return;
    }

    if (args.cmd === "plan") {
      const cfg = await loadConfig(args.config!);
      cfg.host = cfg.host ?? (await HostContext.initialize());
      const mgr = new DotFileManager().loadConfig(cfg);
      const plan = augmentWithDestroys(await mgr.plan());
      // Always persist plan in workspace state
      savePlanToState(plan);
      if (args.out) {
        writeJson(args.out, plan);
        console.log(pc.dim(`Plan written to ${args.out}`));
      }
      if (args.json && !args.out) {
        console.log(JSON.stringify(plan, null, 2));
      } else {
        renderPlan(plan, cfg.host as HostContext | undefined);
      }
      return;
    }

    if (args.cmd === "apply") {
      const mgr = new DotFileManager();
      let plan: Plan;
      let cfg: ManagerConfig | undefined;
      if (args.plan) {
        plan = readJson<Plan>(args.plan);
      } else if (args.config) {
        cfg = await loadConfig(args.config);
        cfg.host = cfg.host ?? (await HostContext.initialize());
        mgr.loadConfig(cfg);
        plan = augmentWithDestroys(await mgr.plan());
        savePlanToState(plan);
      } else {
        throw new Error("apply requires either --plan or --config");
      }
      const report = await mgr.apply(plan);
      // Persist apply results and a compact state snapshot
      saveApplyToState(plan, report);
      if (args.json) console.log(JSON.stringify(report, null, 2));
      else renderApply(report);
      return;
    }
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}

// Bun supports import.meta.main to detect direct execution
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if ((import.meta as any).main) {
  // eslint-disable-next-line unicorn/prefer-top-level-await
  main();
}

export {};

function heading(title: string) {
  console.log(pc.bold(pc.cyan(`› ${title}`)));
}

function renderAnalyze(r: AnalyzeReport) {
  heading("Analyze");
  const errs = r.errors.length + r.conflicts.length;
  const warns = r.lints.length;
  const ok = errs === 0;
  console.log(
    `${ok ? pc.green("✔") : pc.red("✖")} ` +
      `${pc.bold("Issues")} — ${pc.green(`${r.errors.length} errors`)} · ${pc.yellow(`${r.conflicts.length} conflicts`)} · ${pc.yellow(`${warns} warnings`)}`,
  );
  if (!ok) {
    for (const e of [...r.errors, ...r.conflicts]) {
      console.log(`  ${pc.red("●")} ${pc.bold(e.code)} ${pc.dim(e.itemId ? `(${e.itemId})` : "")}\n    ${e.message}`);
    }
  }
  if (warns) {
    for (const w of r.lints) {
      console.log(`  ${pc.yellow("●")} ${pc.bold(w.code)}\n    ${w.message}`);
    }
  }
}

// Config summary (side-effect free) -----------------------------------------

type ConfigSummary = {
  plugins: {
    id: string;
    description?: string;
    version?: string;
    capabilities: { id: string; provides: string[]; description?: string }[];
  }[];
  profiles: {
    name: string;
    priority?: number;
    includes?: string[];
    variables?: Record<string, string>;
    apps?: (string | { name: string })[];
    plugins?: (string | { id: string })[];
    match?: unknown;
    items: {
      id: string;
      kind: string;
      owner?: string;
      deps?: string[];
      spec?: unknown;
      metadataKeys?: string[];
    }[];
  }[];
};

function buildConfigSummary(cfg: ManagerConfig): ConfigSummary {
  const pluginSummaries: ConfigSummary["plugins"] = [];
  for (const p of cfg.plugins ?? []) {
    try {
      // Best-effort read from manifest; avoid calling any functions
      const manifest = (p as unknown as { manifest?: unknown }).manifest as
        | {
            id?: string;
            version?: string;
            description?: string;
            capabilities?: { id?: string; provides?: unknown; description?: string }[];
          }
        | undefined;
      if (!manifest) continue;
      pluginSummaries.push({
        id: String(manifest.id ?? "<unknown>"),
        description: manifest.description,
        version: manifest.version,
        capabilities: (manifest.capabilities ?? []).map((c) => ({
          id: String(c.id ?? "<unknown>"),
          provides: Array.isArray(c.provides)
            ? (c.provides as unknown[]).map((x) => String(x))
            : [],
          description: c.description,
        })),
      });
    } catch {
      // ignore plugin shape errors
    }
  }

  const profileSummaries: ConfigSummary["profiles"] = [];
  for (const p of cfg.profiles ?? []) {
    const items = (p.items ?? []).map((it) => ({
      id: String((it as { id?: unknown }).id ?? ""),
      kind: String((it as { kind?: unknown }).kind ?? ""),
      owner: (it as { owner?: unknown }).owner as string | undefined,
      deps: ((it as { deps?: unknown }).deps as string[] | undefined) ?? undefined,
      spec: (it as { spec?: unknown }).spec,
      metadataKeys: Object.keys(((it as { metadata?: Record<string, unknown> }).metadata ?? {}) as Record<string, unknown>),
      // Pass through optional item renderer when available
      render: (it as unknown as { render?: (opts?: { includeOwner?: boolean; includeDeps?: boolean }) => string }).render,
    }));
    profileSummaries.push({
      name: (p as { name: string }).name,
      priority: (p as { priority?: number }).priority,
      includes: (p as { includes?: string[] }).includes,
      variables: (p as { variables?: Record<string, string> }).variables,
      apps: (p as { apps?: (string | { name: string })[] }).apps,
      plugins: (p as { plugins?: (string | { id: string })[] }).plugins,
      match: (p as { match?: unknown }).match,
      items,
    });
  }

  return {
    plugins: pluginSummaries,
    profiles: profileSummaries,
  };
}

function renderConfigSummary(summary: ConfigSummary) {
  heading("Analyze Config");
  // Plugins
  console.log(`${pc.bold("Plugins")} — ${summary.plugins.length || 0}`);
  if (!summary.plugins.length) {
    console.log(pc.dim("  (none)"));
  } else {
    for (const p of summary.plugins) {
      const caps = p.capabilities.map((c) => `${c.id}${c.provides.length ? pc.dim(` [${c.provides.join(", ")}]`) : ""}`).join(pc.dim(", "));
      const desc = p.description ? ` — ${pc.dim(p.description)}` : "";
      const ver = p.version ? pc.dim(` v${p.version}`) : "";
      console.log(`  • ${pc.bold(p.id)}${ver}${desc}`);
      if (p.capabilities.length) console.log(`     ${pc.dim("caps:")} ${caps}`);
    }
  }

  // Profiles
  console.log("");
  console.log(`${pc.bold("Profiles")} — ${summary.profiles.length || 0}`);
  if (!summary.profiles.length) {
    console.log(pc.dim("  (none)"));
  } else {
    for (const prof of summary.profiles) {
      const counts: string[] = [];
      const items = prof.items?.length ?? 0;
      const apps = prof.apps?.length ?? 0;
      const plugs = prof.plugins?.length ?? 0;
      if (items) counts.push(`${items} item${items === 1 ? "" : "s"}`);
      if (apps) counts.push(`${apps} app${apps === 1 ? "" : "s"}`);
      if (plugs) counts.push(`${plugs} plugin${plugs === 1 ? "" : "s"}`);
      const metaParts: string[] = [];
      if (typeof prof.priority === "number") metaParts.push(`prio ${prof.priority}`);
      if (prof.includes?.length) metaParts.push(`includes: ${prof.includes.join(", ")}`);
      console.log(`  • ${pc.bold(prof.name)}${metaParts.length ? pc.dim(` (${metaParts.join(", ")})`) : ""}${counts.length ? ` — ${counts.join(", ")}` : ""}`);
      if (prof.match) console.log(`     ${pc.dim("match:")} ${formatMatcher(prof.match)}`);
      if (prof.variables && Object.keys(prof.variables).length) {
        const vars = Object.entries(prof.variables)
          .map(([k, v]) => `${k}=${String(v)}`)
          .join(pc.dim(", "));
        console.log(`     ${pc.dim("vars:")} ${vars}`);
      }
      if (prof.plugins?.length) {
        const listed = prof.plugins
          .map((x) => (typeof x === "string" ? x : x?.id ?? ""))
          .filter(Boolean)
          .join(pc.dim(", "));
        console.log(`     ${pc.dim("plugins:")} ${listed}`);
      }
      if (prof.items?.length) {
        for (const it of prof.items) {
          console.log(`     - ${formatItem(it)}`);
        }
      }
    }
  }
}

function formatItem(it: { id: string; kind: string; owner?: string; deps?: string[]; spec?: unknown; metadataKeys?: string[]; render?: (opts?: { includeOwner?: boolean; includeDeps?: boolean }) => string }): string {
  try {
    if (typeof it.render === "function") {
      // Prefer item's own renderer when available
      return it.render({ includeOwner: true, includeDeps: true });
    }
  } catch {}
  const target = formatTarget(it.id);
  const owner = it.owner ? pc.dim(` owner:${it.owner}`) : "";
  const deps = it.deps?.length ? pc.dim(` deps:${it.deps.length}`) : "";
  const spec = summarizeSpec(it.spec);
  const details = [spec, owner, deps].filter(Boolean).join(" ");
  return `${target}${details ? ` ${details}` : ""}`;
}

function summarizeSpec(spec: unknown): string | "" {
  if (spec == null) return "";
  if (typeof spec === "string" || typeof spec === "number" || typeof spec === "boolean") {
    return pc.dim(`spec:${String(spec)}`);
  }
  if (typeof spec === "object") {
    const o = spec as Record<string, unknown>;
    if (typeof o.name === "string") {
      const ver = typeof o.version === "string" ? `@${o.version}` : "";
      return pc.dim(`spec:${o.name}${ver}`);
    }
    const keys = Object.keys(o);
    if (keys.length === 0) return pc.dim("spec:{}");
    return pc.dim(`spec:{${keys.slice(0, 3).join(", ")}${keys.length > 3 ? ", …" : ""}}`);
  }
  return pc.dim("spec:<unknown>");
}

function formatMatcher(m: unknown): string {
  try {
    const mm = m as Record<string, unknown>;
    const parts: string[] = [];
    // Predicates
    if (mm.os) parts.push(`os:${fmtVal(mm.os)}`);
    if (mm.distro) parts.push(`distro:${fmtVal(mm.distro)}`);
    if (mm.arch) parts.push(`arch:${fmtVal(mm.arch)}`);
    if (mm.user) parts.push(`user:${fmtVal(mm.user)}`);
    if (mm.hostname) parts.push(`host:${fmtVal(mm.hostname)}`);
    if (mm.env && typeof mm.env === "object") {
      const env = Object.entries(mm.env as Record<string, unknown>)
        .map(([k, v]) => `${k}=${String(v)}`)
        .join(", ");
      parts.push(`env:{${env}}`);
    }
    if (typeof mm.container === "boolean") parts.push(`container:${mm.container}`);
    if (mm.virtualization) parts.push(`virt:${fmtVal(mm.virtualization)}`);
    // Composition (wrap recursively)
    const comp: string[] = [];
    if (Array.isArray(mm.all)) comp.push(`all(${(mm.all as unknown[]).map(formatMatcher).join(pc.dim(", "))})`);
    if (Array.isArray(mm.any)) comp.push(`any(${(mm.any as unknown[]).map(formatMatcher).join(pc.dim(", "))})`);
    if (mm.not) comp.push(`not(${formatMatcher(mm.not)})`);
    return [...comp, ...parts].join(pc.dim(" ; ")) || pc.dim("<none>");
  } catch {
    return pc.dim("<invalid matcher>");
  }
}

function fmtVal(v: unknown): string {
  if (Array.isArray(v)) return v.map((x) => String(x)).join("|");
  return String(v);
}

function renderPlan(plan: Plan, host?: HostContext) {
  heading("Plan");

  // Host context (one blank line above and below)
  if (host) {
    console.log("");
    const text = host.renderCli();
    if (text) console.log(text);
  }

  // Show legend with dimmed separators (ensure exactly one blank line above and below overall)
  console.log("");
  console.log(`${pc.green("+")} ensure ${pc.dim("|")} ${pc.yellow("~")} update ${pc.dim("|")} ${pc.red("!")} destroy ${pc.dim("|")} ${pc.dim("-")} noop`);
  console.log("");

  if (plan.nodes.length === 0) {
    console.log(pc.dim("No items."));
    return;
  }

  // No items header; list follows directly, grouped by profile
  let ensure = 0, update = 0, del = 0, noop = 0;

  const byProfile = new Map<string, typeof plan.nodes>();
  for (const n of plan.nodes) {
    const prof = (n.metadata as any)?.profile as string | undefined;
    const key = prof ?? "(ungrouped)";
    const arr = byProfile.get(key) ?? [];
    arr.push(n);
    byProfile.set(key, arr);
  }
  const order = [...(plan.header.profiles ?? []), ...Array.from(byProfile.keys()).filter((k) => !(plan.header.profiles ?? []).includes(k))];
  for (const prof of order) {
    const nodes = byProfile.get(prof);
    if (!nodes || nodes.length === 0) continue;
    console.log(pc.bold(prof));
    for (const node of nodes) {
      const kind = node.action === "destroy"
        ? "delete"
        : node.action === "noop"
        ? "none"
        : node.action === "update"
        ? "update"
        : "ensure";
      if (kind === "ensure") ensure++; else if (kind === "update") update++; else if (kind === "delete") del++; else noop++;
      const sym =
        kind === "ensure" ? pc.green("+") :
        kind === "update" ? pc.yellow("~") :
        kind === "delete" ? pc.red("!") : pc.dim("-");
      const target = formatTarget(node.itemId);
      console.log(`${sym} ${target} ${pc.dim(`(plugin: ${node.pluginId ?? "-"}${node.capabilityId ? `, capability: ${node.capabilityId}` : ""})`)}`);
    }
  }

  console.log("");
  console.log(
    pc.bold(`${pc.green(`${ensure} to ensure`)}, ${pc.yellow(`${update} updated`)}, ${pc.red(`${del} deleted`)}, ${pc.dim(`${noop} no action`)}`),
  );
}


function formatTarget(pathOrId: string): string {
  if (!pathOrId) return "<unknown>";
  const idx = pathOrId.indexOf(":");
  if (idx > 0) {
    const kind = pathOrId.slice(0, idx);
    const name = pathOrId.slice(idx + 1);
    return `${kind}[${name}]`;
  }
  return pathOrId;
}

function renderApply(r: ApplyReport) {
  heading("Apply");
  const ok = r.results.filter((x) => x.status === "ok").length;
  const skipped = r.results.filter((x) => x.status === "skipped").length;
  const failed = r.results.filter((x) => x.status === "failed").length;
  for (const res of r.results) {
    const sym =
      res.status === "ok" ? pc.green("✔") : res.status === "skipped" ? pc.yellow("•") : pc.red("✖");
    console.log(`${sym} ${res.nodeId} ${pc.dim(res.startedAt ?? "")}`);
    if (res.error) console.log(pc.red(`   → ${res.error}`));
  }
  console.log(
    `${pc.green(`${ok} ok`)} · ${pc.yellow(`${skipped} skipped`)} · ${pc.red(`${failed} failed`)} · ${pc.dim(`${r.timings.totalMs}ms`)}`,
  );
}

function printTable(headers: string[], rows: string[][]) {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)));
  const fmt = (cells: string[]) =>
    cells
      .map((c, i) => c.padEnd(widths[i]))
      .join("  ");
  console.log(pc.bold(fmt(headers)));
  for (const r of rows) console.log(fmt(r));
}
