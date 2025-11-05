import { z } from "zod";

export const GhosttyConfigSchema = z
  .object({
    font_family: z.string().optional(),
    font_size: z.number().int().positive().optional(),
    theme: z.string().optional(),
    background_opacity: z.number().min(0).max(1).optional(),
  })
  .catchall(z.union([z.string(), z.number(), z.boolean()]));

export type GhosttyConfig = z.infer<typeof GhosttyConfigSchema>;

export function serializeConfig(cfg: GhosttyConfig): string[] {
  return Object.entries(cfg).map(([k, v]) => `${k}=${serializeValue(v)}`);
}

function serializeValue(v: unknown): string {
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}
