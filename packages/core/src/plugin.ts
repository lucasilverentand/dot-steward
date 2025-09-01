import type { z } from "zod";

export abstract class Plugin<T = unknown> {
  abstract readonly name: string;
  abstract readonly schema: z.ZodType<T>;
  prepare?(): Promise<void> | void;
}
