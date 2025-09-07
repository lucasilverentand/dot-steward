import { MisePlugin } from "./plugin.ts";
import { MiseTool } from "./tool.ts";
import { MiseGlobalTools } from "./global.ts";
import { shell_config } from "../../shell-config/src/index.ts";

type PkgInput =
  | string
  | [name: string, version?: string]
  | { name: string; version?: string };

function parsePkg(input: PkgInput): { name: string; version?: string } {
  if (typeof input === "string") {
    const s = input.trim();
    const at = s.lastIndexOf("@");
    if (at <= 0) return { name: s };
    const name = s.slice(0, at);
    const version = s.slice(at + 1) || undefined;
    return { name, version };
  }
  if (Array.isArray(input)) {
    const [name, version] = input;
    return { name, version };
  }
  return { name: input.name, version: input.version };
}

let activationAdded = false;
function addActivationOnce(opts?: { zsh?: boolean; bash?: boolean }) {
  if (activationAdded) return;
  const enableZsh = opts?.zsh !== false; // default true
  const enableBash = opts?.bash !== false; // default true
  if (enableZsh)
    shell_config.rc.lines(
      [
        'if command -v mise >/dev/null 2>&1; then eval "$(mise activate zsh)"; fi',
      ],
      "zsh",
    );
  if (enableBash)
    shell_config.rc.lines(
      [
        'if command -v mise >/dev/null 2>&1; then eval "$(mise activate bash)"; fi',
      ],
      "bash",
    );
  activationAdded = true;
}
import { MiseSetup } from "./setup.ts";

export const mise = {
  // Define a single tool to be installed and set globally
  tool(
    name: string,
    version?: string,
    opts?: {
      plugin?: MisePlugin;
      activateShell?: boolean;
      shells?: ("zsh" | "bash")[];
    },
  ) {
    if (opts?.activateShell ?? true)
      addActivationOnce({
        zsh: !opts?.shells || opts.shells.includes("zsh"),
        bash: !opts?.shells || opts.shells.includes("bash"),
      });
    return new MiseTool(name, version, opts);
  },

  // Convenience: accept "tool@version" or tuple/object
  pkg(
    spec: PkgInput,
    opts?: {
      plugin?: MisePlugin;
      activateShell?: boolean;
      shells?: ("zsh" | "bash")[];
    },
  ) {
    const { name, version } = parsePkg(spec);
    return mise.tool(name, version, opts);
  },

  // Define a set of tools with versions to set globally
  global(
    tools: Record<string, string | undefined> | Array<PkgInput>,
    opts?: {
      plugin?: MisePlugin;
      activateShell?: boolean;
      shells?: ("zsh" | "bash")[];
    },
  ) {
    if (opts?.activateShell ?? true)
      addActivationOnce({
        zsh: !opts?.shells || opts.shells.includes("zsh"),
        bash: !opts?.shells || opts.shells.includes("bash"),
      });
    if (Array.isArray(tools)) {
      const rec: Record<string, string | undefined> = {};
      for (const t of tools) {
        const { name, version } = parsePkg(t);
        rec[name] = version;
      }
      return new MiseGlobalTools(rec, opts);
    }
    return new MiseGlobalTools(tools, opts);
  },

  // Install mise without configuring any packages
  setup(opts?: { plugin?: MisePlugin }) {
    return new MiseSetup(opts);
  },
};

export { MisePlugin, misePlugin } from "./plugin.ts";
