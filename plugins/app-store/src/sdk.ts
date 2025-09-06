import { brew } from "@dot-steward/plugin-brew";
import { AppStoreApp } from "./app.ts";

export const appStore = {
  // Returns a tuple [brew.mas, app] so brew handles mas installation
  app(id: number | string, opts?: { name?: string }) {
    const mas = brew.formula("mas");
    const app = new AppStoreApp(id, { name: opts?.name, dep: mas });
    return [mas, app];
  },
};
