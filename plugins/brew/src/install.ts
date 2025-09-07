import type { HostContext } from "@dot-steward/core";
import type { ExecPlugin } from "../../exec/src/plugin.ts";
import { execCapture, findBrewCmd } from "./common.ts";

export async function isHomebrewInstalled(): Promise<boolean> {
  return (await findBrewCmd()) !== null;
}

export async function installHomebrewNonInteractive(
  ctx: HostContext,
  exec?: ExecPlugin,
): Promise<void> {
  const script =
    "curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh | NONINTERACTIVE=1 /bin/bash";
  const env = { ...ctx.env.variables, NONINTERACTIVE: "1" };
  // Homebrew should not be installed via sudo. Run as the invoking user.
  if (ctx.user.is_root) {
    throw new Error(
      "Homebrew install should not be run as root. Please run dot-steward as a non-root user.",
    );
  }
  const res = exec
    ? await exec.run(script, { shell: "bash", env }, ctx)
    : await execCapture("/bin/bash", ["-lc", script], { env });
  const ok = res.ok;
  const stderr = res.stderr;
  if (!ok) {
    throw new Error(
      `Homebrew installation failed. ${stderr ? `Details: ${stderr}` : ""}`,
    );
  }
  const path = await findBrewCmd();
  if (!path) {
    throw new Error(
      "Homebrew install script completed but brew command was not found.",
    );
  }
}
