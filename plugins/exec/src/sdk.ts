import { ExecCommand, type ExecCommandOptions } from "./cmd.ts";
import type { ExecPlugin } from "./plugin.ts";

export const exec = {
  cmd(
    name: string,
    apply: string,
    opts?: ExecCommandOptions & { cleanup?: string; plugin?: ExecPlugin },
  ) {
    return new ExecCommand(name, apply, opts?.cleanup, opts, opts?.plugin);
  },
  always(
    name: string,
    apply: string,
    opts?: Omit<ExecCommandOptions, "always"> & { plugin?: ExecPlugin },
  ) {
    return new ExecCommand(
      name,
      apply,
      undefined,
      { ...(opts ?? {}), always: true },
      opts?.plugin,
    );
  },
};

export { ExecPlugin, execPlugin } from "./plugin.ts";
export type { ShellKind } from "./exec.ts";

