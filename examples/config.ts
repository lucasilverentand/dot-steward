import { os, all, any, config, hostname, profile } from "@dot-steward/core";
import { brew } from "../plugins/brew/src";
import { file } from "../plugins/file/src";
import { shell } from "../plugins/shell/src";
import { appStore } from "../plugins/app-store/src";
import { mac_settings } from "../plugins/macos-settings/src";

// Homebrew casks no longer require tapping; use brew.cask directly

const mac_base = profile({
  name: "mac-base",
  matches: os("darwin"),
  // Inputs allow composing items conditionally
  inputs: {
    browser: {
      type: "select",
      choices: ["chrome", "firefox"],
      default: "chrome",
      description: "Preferred browser to install",
    },
    include_hand_mirror: {
      type: "boolean",
      default: false,
      description: "Install Hand Mirror from the App Store",
    },
  },
  items: ({ input, when }) => [
    brew.formula("cowsay"),
    // Choose browser via input
    ...when(input.browser === "chrome", brew.cask("google-chrome")),
    ...when(input.browser === "firefox", brew.cask("firefox")),
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
    // Example shell commands
    shell.cmd("echo hello", "echo 'hello from dot-steward'"),
    // macOS settings via defaults (validated by zod)
    mac_settings({
      mouse: { speed: 0.5 },
      dock: { autohide: true },
    }),
    // Optional: install a Mac App Store app when enabled
    ...when(
      !!input.include_hand_mirror,
      appStore.app(1502839586, { name: "Hand Mirror" }),
    ),
  ],
});

const mac_dev = profile({
  name: "mac-dev",
  matches: all(os("darwin"), any(hostname("mac"), hostname("macbook-air-luca"))),
  items: [brew.formula("git")],
});

export default config({
  profiles: [mac_base, mac_dev],
});
