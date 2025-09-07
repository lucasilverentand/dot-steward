import { os, config, profile } from "@dot-steward/core";
import { appStore } from "../plugins/app-store/src";
import { brew } from "../plugins/brew/src";
import { file } from "../plugins/file/src";
import { mac_settings } from "../plugins/macos-settings/src";
import { shell } from "../plugins/shell/src";

// Homebrew casks no longer require tapping; use brew.cask directly

const mac = profile({
  name: "mac",
  matches: os("darwin"),
  // Static items list for a simple getting-started profile
  items: [
    brew.formula("cowsay"),
    brew.cask("google-chrome"),
    // Example: compose YAML config written to user's home
    file.yaml(
      ".config/dot-steward/app.yaml",
      file.compose(
        { app: { name: "demo", theme: "${theme}", features: ["a", "b"] } },
        { app: { features: ["x", "y"], retries: 3 } },
      ),
      { vars: { theme: "dark" } },
    ),
    // Example: copy a file from the repo to the user's config dir
    file.from("examples/hello.txt", ".config/dot-steward/hello.txt", {
      mode: 0o644,
    }),
    // Example shell command
    shell.cmd("echo hello", "echo 'hello from dot-steward'"),
    // macOS settings via defaults (validated by zod)
    mac_settings({
      mouse: { speed: 0.5 },
      dock: { autohide: true },
    }),
    // Example: Mac App Store app (optional; requires being signed in to App Store)
    // appStore.app(1502839586, { name: "Hand Mirror" }),
  ],
});

export default config([mac]);
