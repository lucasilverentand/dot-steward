import { ShellCommand, type ShellCommandOptions } from "./cmd.ts";
import { ShellPlugin } from "./plugin.ts";

export const shell = {
  // Define a shell command with optional cleanup
  cmd(
    name: string,
    apply: string,
    opts?: ShellCommandOptions & { cleanup?: string; plugin?: ShellPlugin },
  ) {
    return new ShellCommand(name, apply, opts?.cleanup, opts, opts?.plugin);
  },

  // Convenience: always-run (no-op cleanup by default)
  always(name: string, apply: string, opts?: Omit<ShellCommandOptions, "always"> & { plugin?: ShellPlugin }) {
    return new ShellCommand(name, apply, undefined, { ...(opts ?? {}), always: true }, opts?.plugin);
  },
};

export { ShellPlugin, shellPlugin } from "./plugin.ts";

