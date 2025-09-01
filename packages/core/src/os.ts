import { z } from "zod";

export const OS = z.enum(["darwin", "linux", "win32"]);
export type OS = z.infer<typeof OS>;
