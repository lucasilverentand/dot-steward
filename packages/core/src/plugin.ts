import { z } from "zod";
import { type HostMatchExpr, HostMatchExprSchema } from "./host/matching.ts";
import { Item, ItemSchema, type ItemStatus } from "./item.ts";

export const PluginSchema = ItemSchema.extend({
  name: z.string().min(2).max(100),
  matches: HostMatchExprSchema, // required: every plugin must declare compatibility
});

export abstract class Plugin extends Item {
  readonly name: string;
  readonly matches: HostMatchExpr;

  constructor(
    name: string,
    matches: HostMatchExpr,
    opts?: { status?: ItemStatus },
  ) {
    // Validate constructor inputs
    z.object({ name: z.string().min(2).max(100), matches: HostMatchExprSchema })
      .strict()
      .parse({ name, matches });
    super({
      kind: "plugin",
      state: opts?.status ? { status: opts.status } : undefined,
    });
    this.name = name;
    this.matches = matches;
  }

  async validate(_ctx: import("./host/context.ts").HostContext): Promise<void> {
    // Plugins can override if they need config validation.
  }

  // Optional: declare other plugins this plugin depends on/uses.
  // Manager will ensure these plugins are discovered, add dependency edges,
  // and, if provided, call `assign` with the resolved instance for injection.
  // This is intentionally duck-typed: plugins do not need to extend types.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  get_used_plugins?(): Array<{
    key: string; // plugin name (e.g., 'shell')
    get_plugin_factory: () => Plugin; // factory to create the plugin if absent
    assign?: (p: Plugin) => void; // optional injector for keeping a reference
  }>;
}
