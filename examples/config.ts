import { os, all, any, config, hostname, profile } from "@dot-steward/core";
import { brew } from "../plugins/brew/src";
import { file } from "../plugins/file/src";
import { shell } from "../plugins/shell/src";

// Homebrew casks no longer require tapping; use brew.cask directly

const mac_base = profile({
  name: "mac-base",
  matches: os("darwin"),
  items: [
    brew.formula("cowsay"),
    brew.cask("google-chrome"),
    brew.cask("firefox"),
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
  ].flat(),
});

const mac_dev = profile({
  name: "mac-dev",
  matches: all(os("darwin"), any(hostname("mac"), hostname("macbook-air-luca"))),
  items: [brew.formula("git")],
});

export default config({
  profiles: [mac_base, mac_dev],
});
