import type { AnalyzeReport, Plan } from "@dot-steward/types";
import { detectHostFacts } from "./host";
import { AnalyzePhase } from "./phases/analyze";
import { ApplyPhase } from "./phases/apply";
import { PlanPhase } from "./phases/plan";
import type { ManagerConfig, ManagerOptions } from "./types";
import { PluginRegistry } from "./plugins";

export class DotFileManager {
  private analyzePhase: AnalyzePhase;
  private planPhase: PlanPhase;
  private applyPhase: ApplyPhase;
  private readonly options: ManagerOptions;
  private readonly plugins: PluginRegistry;

  constructor(options: ManagerOptions = {}) {
    this.options = options;
    this.plugins = new PluginRegistry(options.plugins ?? []);
    this.analyzePhase = new AnalyzePhase(this.plugins);
    this.planPhase = new PlanPhase(this.plugins);
    this.applyPhase = new ApplyPhase(this.plugins);
  }

  withPlugins(plugins: import("@dot-steward/types").Plugin[]): this {
    this.plugins.registerMany(plugins);
    // Recreate analyze phase to include updated registry
    this.analyzePhase = new AnalyzePhase(this.plugins);
    this.planPhase = new PlanPhase(this.plugins);
    this.applyPhase = new ApplyPhase(this.plugins);
    return this;
  }

  analyze(cfg: ManagerConfig): AnalyzeReport {
    if (cfg.plugins?.length) this.withPlugins(cfg.plugins);
    const host = cfg.host ?? detectHostFacts();
    return this.analyzePhase.run({ profiles: cfg.profiles, host });
  }

  plan(cfg: ManagerConfig): Plan {
    if (cfg.plugins?.length) this.withPlugins(cfg.plugins);
    const host = cfg.host ?? detectHostFacts();
    return this.planPhase.buildDAG({ profiles: cfg.profiles, host });
  }

  async apply(plan: Plan) {
    return this.applyPhase.executePlan(plan, {});
  }
}
