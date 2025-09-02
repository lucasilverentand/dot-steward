import type { OS } from "./host";
import type { HostContext } from "./host";

export interface EvalContext {
  os: OS;
  env: Record<string, string | undefined>;
  host: HostContext;
}

export type Matcher = (ctx: EvalContext) => boolean;
