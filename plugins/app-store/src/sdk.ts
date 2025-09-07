import { AppStoreApp } from "./app.ts";

export const app_store = {
  // Return a single item; the App Store plugin ensures `mas` is installed.
  app(id: number | string, opts?: { name?: string }) {
    return new AppStoreApp(id, { name: opts?.name });
  },
};
