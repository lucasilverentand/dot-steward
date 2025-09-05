import type { Manager } from "@dot-steward/core";
import pc from "picocolors";

// Build the lines used in the "Host Details" panel section
export function buildHostPanelLines(mgr: Manager): string[] {
  const envFlags = [
    mgr.host.env.ci ? "ci" : "not ci",
    mgr.host.env.devcontainer ? "devcontainer" : "not devcontainer",
  ].join(", ");
  const userName = String(mgr.host.user.name ?? "-");
  const uidStr = String(mgr.host.user.uid ?? "-");
  const gidStr = String(mgr.host.user.gid ?? "-");
  const homeStr = String(mgr.host.user.home ?? "-");
  const userLine = `${userName} (gid: ${gidStr}, uid: ${uidStr}, home: ${homeStr})`;
  const hostLines: Array<[string, string]> = [
    ["Hostname", String(mgr.host.hostname ?? "-")],
    ["OS", String(mgr.host.os ?? "-")],
    ["Arch", String(mgr.host.arch ?? "-")],
    ["Shell", String(mgr.host.env.variables.SHELL ?? "-")],
    ["Env", envFlags],
    ["User", userLine],
  ];
  const labelWidth = Math.max(0, ...hostLines.map(([k]) => String(k).length));
  return hostLines.map(([k, v]) => {
    const label = String(k).padStart(labelWidth, " ");
    return `${pc.dim(label)}  ${v}`;
  });
}

export default buildHostPanelLines;

