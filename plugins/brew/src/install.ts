import { execCapture, findBrewCmd } from "./common.ts";
import type { HostContext } from "@dot-steward/core";
import type { ShellPlugin } from "@dot-steward/plugin-shell";

export async function isHomebrewInstalled(): Promise<boolean> {
  return (await findBrewCmd()) !== null;
}

export async function installHomebrewNonInteractive(
  ctx: HostContext,
  shell?: ShellPlugin,
): Promise<void> {
  const script =
    "curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh | NONINTERACTIVE=1 /bin/bash";
  const env = { ...ctx.env.variables, NONINTERACTIVE: "1" };
  const res = shell
    ? await shell.run(script, { shell: "bash", env, sudo: "auto" }, ctx)
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
