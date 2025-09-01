import { z } from "zod";

export const OS = z.enum(["darwin", "linux", "win32"]);
export type OS = z.infer<typeof OS>;

export const Base = z.object({ id: z.string().min(1) });

export abstract class Plugin<T = unknown> {
  abstract readonly name: string;
  abstract readonly schema: z.ZodType<T>;
  prepare?(): Promise<void> | void;
}

export { z };
