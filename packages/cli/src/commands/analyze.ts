import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { Manager } from "@dot-steward/core";
import type { HostMatchExpr } from "@dot-steward/core";
import { renderKeyValueBox, renderListBox, renderKeyValueGridBox } from "../utils/table.ts";
import type { Command } from "commander";

function resolveConfigToFileUrl(p: string): string {
  const abs = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
  return pathToFileURL(abs).href;
}

export function registerAnalyze(program: Command): void {
  program
    .command("analyze")
    .description("Analyze the current host and config")
    .option(
      "-c, --config <path>",
      "Path to config file (TS/JS)",
      "dot-steward.config.ts",
    )
    .action(async (opts: { config: string }) => {
      const mgr = new Manager();
      const cfgUrl = resolveConfigToFileUrl(opts.config);
      // Subscribe to events for progress output
      const short = (id: string) => id.slice(0, 8);
      const itemRef = (p: { kind: string; name?: string; item_id: string }) =>
        `[${p.kind}] ${p.name ?? short(p.item_id)}`;
      const offs = [
        mgr.events.on("item:probe_start", (e) => {
          console.log(`probe: ${itemRef(e)}`);
        }),
        mgr.events.on("item:probe_done", (e) => {
          console.log(`probe: ${itemRef(e)} status=${e.status ?? "unknown"}`);
        }),
        mgr.events.on("item:probe_error", (e) => {
          console.log(`probe: ${itemRef(e)} error=${e.error}`);
        }),
      ];
      try {
        await mgr.init(cfgUrl);
      } catch (err) {
        console.error(
          `Failed to load config from ${opts.config}. Try --config examples/config.ts`,
        );
        if (err instanceof Error) console.error(err.message);
        process.exitCode = 1;
        return;
      }

      // Run analyze phase (plugin probes)
      try {
        await mgr.analyze();
      } catch (err) {
        console.error("Analyze failed while probing plugins.");
        if (err instanceof Error) console.error(err.message);
        process.exitCode = 1;
        return;
      }

      // Helper: pretty-print match expressions
      const fmtRegex = (m: { matches: string; flags?: string }) =>
        `/${m.matches}/${m.flags ?? ""}`;
      const fmtVal = (v: unknown): string => {
        if (typeof v === "string") return v;
        if (typeof v === "boolean") return v ? "true" : "false";
        if (typeof v === "object" && v && "matches" in v) {
          const mv = v as { matches: string; flags?: string };
          return fmtRegex(mv);
        }
        return String(v);
      };
      const fmtMatch = (expr: HostMatchExpr): string => {
        switch (expr.type) {
          case "all":
            return `(${expr.of.map((e) => fmtMatch(e)).join(" AND ")})`;
          case "any":
            return `(${expr.of.map((e) => fmtMatch(e)).join(" OR ")})`;
          case "os":
            return `os in [${expr.values.join(", ")}]`;
          case "arch":
            return `arch in [${expr.values.join(", ")}]`;
          case "hostname":
            return `hostname ${
              typeof expr.value === "string"
                ? `= ${expr.value}`
                : `~ ${fmtRegex(expr.value)}`
            }`;
          case "eq": {
            const k = expr.key;
            const v = expr.value;
            if (typeof v === "boolean") return `${k} is ${fmtVal(v)}`;
            if (typeof v === "string") return `${k} = ${v}`;
            return `${k} ~ ${fmtRegex(v)}`;
          }
          case "env-var": {
            if (expr.value === undefined) return `env[${expr.name}] exists`;
            return `env[${expr.name}] ${
              typeof expr.value === "string"
                ? `= ${expr.value}`
                : `~ ${fmtRegex(expr.value)}`
            }`;
          }
        }
      };

      // compact match for narrow display
      const fmtMatchCompact = (expr: HostMatchExpr): string => {
        switch (expr.type) {
          case "all":
            return expr.of.map((e) => fmtMatchCompact(e)).join(" & ");
          case "any":
            return expr.of.map((e) => fmtMatchCompact(e)).join(" | ");
          case "os":
            return `os:${expr.values.join("|")}`;
          case "arch":
            return `arch:${expr.values.join("|")}`;
          case "hostname":
            return `host:${
              typeof expr.value === "string"
                ? expr.value
                : `~${expr.value.matches}${expr.value.flags ? "/" + expr.value.flags : ""}`
            }`;
          case "eq": {
            const m = (key: string) => key.replace(/^user\./, "");
            const v = expr.value;
            if (typeof v === "boolean") return `${m(expr.key)}:${v ? "true" : "false"}`;
            if (typeof v === "string") return `${m(expr.key)}:${v}`;
            return `${m(expr.key)}:~${v.matches}${v.flags ? "/" + v.flags : ""}`;
          }
          case "env-var": {
            if (expr.value === undefined) return `env.${expr.name}`;
            if (typeof expr.value === "string") return `env.${expr.name}:${expr.value}`;
            return `env.${expr.name}:~${expr.value.matches}${expr.value.flags ? "/" + expr.value.flags : ""}`;
          }
        }
      };

      // Render match as a simple flow/tree with connectors
      const renderMatchFlow = (expr: HostMatchExpr, maxWidth = 44): string => {
        const lines: string[] = [];
        const crop = (s: string, w: number) => {
          if (w <= 0) return "";
          if (s.length <= w) return s;
          if (w <= 1) return "…";
          return s.slice(0, w - 1) + "…";
        };
        const labelFor = (e: HostMatchExpr): string => {
          switch (e.type) {
            case "all":
              return "[ALL]";
            case "any":
              return "[ANY]";
            case "os":
              return `os:${e.values.join("|")}`;
            case "arch":
              return `arch:${e.values.join("|")}`;
            case "hostname":
              return `host:${
                typeof e.value === "string"
                  ? e.value
                  : `~${e.value.matches}${e.value.flags ? "/" + e.value.flags : ""}`
              }`;
            case "eq": {
              const key = e.key.replace(/^user\./, "");
              const v = e.value;
              if (typeof v === "boolean") return `${key}:${v ? "true" : "false"}`;
              if (typeof v === "string") return `${key}:${v}`;
              return `${key}:~${v.matches}${v.flags ? "/" + v.flags : ""}`;
            }
            case "env-var": {
              if (e.value === undefined) return `env.${e.name}`;
              if (typeof e.value === "string") return `env.${e.name}:${e.value}`;
              return `env.${e.name}:~${e.value.matches}${e.value.flags ? "/" + e.value.flags : ""}`;
            }
          }
        };
        const walk = (e: HostMatchExpr, prefix: string, isLast: boolean, isRoot = false) => {
          const branch = isRoot ? "" : isLast ? "└─ " : "├─ ";
          const nextPrefix = isRoot ? "" : isLast ? "   " : "│  ";
          const lab = labelFor(e);
          const contentWidth = Math.max(1, maxWidth - prefix.length - branch.length);
          lines.push(prefix + branch + crop(lab, contentWidth));
          if (e.type === "all" || e.type === "any") {
            const arr = e.of;
            arr.forEach((child, idx) => {
              walk(child, prefix + nextPrefix, idx === arr.length - 1, false);
            });
          }
        };
        walk(expr, "", true, true);
        return lines.join("\n");
      };

      // Output a simple diagnostic summary
      const hc = mgr.host;
      const hostRows: Array<[string, string]> = [
        ["OS", hc.os ?? "unknown"],
        ["Arch", hc.arch ?? "unknown"],
        ["User", hc.user.name ?? "-"],
        ["UID", hc.user.uid ?? "-"],
        ["GID", hc.user.gid ?? "-"],
        ["Home", hc.user.home ?? "-"],
        ["CI", hc.env.ci ? "yes" : "no"],
        ["Devcontainer", hc.env.devcontainer ? "yes" : "no"],
      ];
      console.log(
        renderKeyValueGridBox(hostRows, {
          columns: 2,
          gap: 2,
          colGap: 4,
          padding: 1,
          dimLabels: true,
          title: "Host Details",
          labelMax: 12,
          valueMax: 32,
        }),
      );

      // Plugins summary (before profiles)
      const pluginItems = mgr.plugins.map((plg) => plg.render());
      console.log(
        renderListBox(pluginItems.length ? pluginItems : ["none"], {
          title: "Plugins",
          dimItems: true,
        }),
      );

      // Profiles: one box per profile with essential details
      if (mgr.profiles.length === 0) {
        console.log(renderListBox(["none"], { title: "Profiles", dimItems: true }));
      } else {
        for (const p of mgr.profiles) {
          const matched = hc.evaluateMatch(p.matches);
          const rows: Array<[string, string]> = [];
          rows.push(["Matched", matched ? "yes" : "no"]);
          rows.push(["Match", renderMatchFlow(p.matches, 44)]);
          const footer = p.items.map((it) => it.render());
          console.log(
            renderKeyValueBox(rows, {
              padding: 1,
              gap: 2,
              dimLabels: true,
              title: p.render(),
              maxWidth: 70,
              valueMax: 44,
              labelMax: 10,
              footerLines: footer,
            }),
          );
        }
      }

      // (removed) Items: full list across profiles

      // Unsubscribe listeners at the end of command
      for (const off of offs) off();
    });
}
