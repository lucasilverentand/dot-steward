import { config, profile } from "@dot-steward/core";
import { BrewPlugin } from "@dot-steward/plugin-brew";

const brew = new BrewPlugin();

export default config({
  plugins: [brew],
  profiles: [
    profile("darwin-base", {
      items: [],
    }),
  ],
});
