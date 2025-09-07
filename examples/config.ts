import { os, config, profile } from "@dot-steward/core";
import { appStore } from "../plugins/app-store/src/index.ts";
import { brew } from "../plugins/brew/src/index.ts";
import { file } from "../plugins/file/src/index.ts";
import { mac_settings } from "../plugins/macos-settings/src/index.ts";
import { mise } from "../plugins/mise/src/index.ts";
import { exec } from "../plugins/exec/src/index.ts";
import { shell_config } from "../plugins/shell-config/src/index.ts";

// Homebrew casks no longer require tapping; use brew.cask directly

// Contribute to shell rc config from top-level (accumulator returns void)
shell_config.rc.paths(["~/.local/bin"]);
shell_config.rc.aliases({ ll: "ls -lah", gs: "git status" });
shell_config.rc.exports({ EDITOR: "vim" });

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
    // Example exec command
    exec.cmd("echo hello", "echo 'hello from dot-steward'"),
    // Build the composed shell rc config into a single managed item
    shell_config.rc.build(),
    // Ensure mise is installed and set default global tools
    // Configure your desired tools and versions here
    mise.global(["node@lts", "bun@latest"]),
    // Alternatively, single tools can be declared as pkg("name@version")
    // mise.pkg("node@lts"),
    // macOS settings via defaults (validated by zod)
    mac_settings({
      mouse: { speed: 0.2 },
      dock: { autohide: false, tilesize: 60, largesize: 70, orientation: 'bottom' },
    }),
    // Example: Mac App Store app (optional; requires being signed in to App Store)
    // appStore.app(1502839586, { name: "Hand Mirror" }),
  ],
});

export default config(mac);
