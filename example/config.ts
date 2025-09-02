import { config, profile } from "@dot-steward/core";
import { any, darwin, linux } from "@dot-steward/matchers";
import { brew, cask } from "@dot-steward/brew";

export default config({
  profiles: [
    profile("dev", any([darwin(), linux()]))
      .add(brew("codex"))
      .add(cask("google-chrome"), cask("firefox"))
      .add(
        ghostty({
          // installs using brew or apt
          version: "latest", // optional
          config: config({}),
        }),
      ),
  ],
});
