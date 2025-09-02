import { DotFileManager, computePlanHash } from "@dot-steward/core";
import type { ManagerConfig } from "@dot-steward/core";
import type {
  AnalyzeReport,
  Plan,
  ApplyReport,
  ActionNode,
  Diff,
} from "@dot-steward/types";
import { pathToFileURL } from "node:url";
import * as fs from "node:fs";
import * as path from "node:path";
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
  writeJson(path.join(root, "state.json"), {
    lastApplyAt: new Date().toISOString(),
    planHash: plan.hash,
    nodes: plan.nodes.length,
    edges: plan.edges.length,
    summary: { ok, skipped, failed },
    items: inventory,
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

function augmentWithDestroys(current: Plan): Plan {
  const prev = loadInventoryFromState();
  if (!prev) return current;
  const currItems = new Set(current.nodes.map((n) => n.itemId));
  const toDestroy = Array.from(prev.keys()).filter((id) => !currItems.has(id));
  if (toDestroy.length === 0) return current;

  const destroyNodes: ActionNode[] = [];
  for (const id of toDestroy) {
    const changePath = id;
    const diff: Diff = {
      current: "present",
      desired: null,
      idempotent: true,
      changes: [
        {
          path: String(changePath),
          from: "present",
          to: undefined,
        } as unknown as NonNullable<Diff["changes"]>[number],
      ],
    } as Diff;
    destroyNodes.push({
      id: `node:${id}:destroy`,
      itemId: id,
      pluginId: prev.get(id)?.pluginId,
      capabilityId: prev.get(id)?.capabilityId,
      action: "destroy",
      diff,
      locks: [],
      metadata: { kind: prev.get(id)?.kind ?? "unknown" },
    });
  }
  const merged: Plan = {
    ...current,
    nodes: [...current.nodes, ...destroyNodes],
    // edges unchanged; no new deps for destroys for now
  };
  // Recompute hash to reflect appended destroys (ignoring createdAt)
  merged.hash = computePlanHash({
    header: merged.header,
    nodes: merged.nodes,
    edges: merged.edges,
    previews: merged.previews,
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
  dot-steward apply -c <config.ts> | -p <plan.json>
`);
    process.exit(args.cmd === "help" ? 0 : 1);
  }

  try {
    if (args.cmd === "analyze") {
      const cfg = await loadConfig(args.config!);
      const mgr = new DotFileManager();
      const report = mgr.analyze(cfg);
      if (args.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        renderAnalyze(report);
      }
      return;
    }

    if (args.cmd === "plan") {
      const cfg = await loadConfig(args.config!);
      const mgr = new DotFileManager();
      const plan = augmentWithDestroys(mgr.plan(cfg));
      // Always persist plan in workspace state
      savePlanToState(plan);
      if (args.out) {
        writeJson(args.out, plan);
        console.log(pc.dim(`Plan written to ${args.out}`));
      }
      if (args.json && !args.out) {
        console.log(JSON.stringify(plan, null, 2));
      } else {
        renderPlan(plan);
      }
      return;
    }

    if (args.cmd === "apply") {
      const mgr = new DotFileManager();
      let plan: Plan;
      if (args.plan) {
        plan = readJson<Plan>(args.plan);
      } else if (args.config) {
        const cfg = await loadConfig(args.config);
        plan = augmentWithDestroys(mgr.plan(cfg));
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
  console.log(pc.bold(pc.cyan(`\n› ${title}`)));
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

function renderPlan(plan: Plan) {
  heading("Plan");
  console.log(`${pc.green("✔")} ${pc.bold("Hash")} ${pc.dim(plan.hash)}`);
  console.log(`${pc.blue("•")} ${pc.bold("Nodes")} ${plan.nodes.length}   ${pc.blue("•")} ${pc.bold("Edges")} ${plan.edges.length}`);

  const changes = plan.nodes
    .filter((n) => Array.isArray(n.diff?.changes) && (n.diff?.changes as unknown[]).length > 0)
    .map((n) => ({ node: n, change: (n.diff.changes as any[])[0] as { path?: string; from?: unknown; to?: unknown } }))
    .map(({ node, change }) => ({ node, change, kind: classifyChange(change) }));

  if (changes.length === 0) {
    console.log(pc.dim("No changes required."));
    return;
  }

  const add = changes.filter((c) => c.kind === "add").length;
  const upd = changes.filter((c) => c.kind === "change").length;
  const del = changes.filter((c) => c.kind === "destroy").length;

  console.log("\nResource actions are indicated with the following symbols:");
  console.log(`  ${pc.green("+")} create`);
  console.log(`  ${pc.yellow("~")} update`);
  console.log(`  ${pc.red("-")} destroy`);

  console.log("\nDot Steward will perform the following actions:\n");
  for (const { node, change, kind } of changes) {
    const sym = kind === "add" ? pc.green("+") : kind === "destroy" ? pc.red("-") : pc.yellow("~");
    const verb = kind === "add" ? "created" : kind === "destroy" ? "destroyed" : "updated";
    const target = formatTarget(change?.path ?? node.itemId);
    console.log(`  # ${target} will be ${verb}`);
    console.log(`  ${sym} ${target} ${pc.dim(`(plugin: ${node.pluginId ?? "-"}${node.capabilityId ? `, capability: ${node.capabilityId}` : ""})`)}`);
    if (kind === "change" && change && change.from !== undefined && change.to !== undefined && change.from !== change.to) {
      console.log(`      ${pc.dim(String(change.from))} -> ${pc.dim(String(change.to))}`);
    }
    console.log("");
  }

  console.log(pc.bold(`Plan: ${pc.green(`${add} to add`)}, ${pc.yellow(`${upd} to change`)}, ${pc.red(`${del} to destroy`)}`));
}

function classifyChange(change: { from?: unknown; to?: unknown } | undefined): "add" | "change" | "destroy" {
  if (!change) return "change";
  const from = change.from;
  const to = change.to;
  const isNullish = (v: unknown) => v === undefined || v === null;
  if (isNullish(from) && !isNullish(to)) return "add";
  if (!isNullish(from) && isNullish(to)) return "destroy";
  if (from !== to) return "change";
  return "change";
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
    `\n${pc.bold("Summary")} — ${pc.green(`${ok} ok`)} · ${pc.yellow(`${skipped} skipped`)} · ${pc.red(`${failed} failed`)} · ${pc.dim(`${r.timings.totalMs}ms`)}`,
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
