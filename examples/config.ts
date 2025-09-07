import { os, config, profile } from "@dot-steward/core";
import { app_store } from "../plugins/app-store/src/index.ts";
import { brew } from "../plugins/brew/src/index.ts";
import { exec } from "../plugins/exec/src/index.ts";
import { file } from "../plugins/file/src/index.ts";
import { mac_settings } from "../plugins/macos-settings/src/index.ts";
import { mise } from "../plugins/mise/src/index.ts";
import { shell_config } from "../plugins/shell-config/src/index.ts";
import { starship } from "../plugins/starship/src/index.ts";

// Homebrew casks no longer require tapping; use brew.cask directly

// Contribute to shell rc config from top-level (accumulator returns void)
shell_config.rc.paths(["~/.local/bin"]);
shell_config.rc.aliases({ ll: "ls -lah", gs: "git status" });
shell_config.rc.exports({ EDITOR: "vim" });

const mac = profile({
  name: "mac",
  matches: os("darwin"),
  items: [
    brew.formula("cowsay"),
    brew.cask("google-chrome"),
    // Starship prompt (install via brew and initialize in shell rc)
    brew.formula("starship"),
    starship.init(),
    // Optional: manage ~/.config/starship.toml
    starship.toml({
      add_newline: false,
      scan_timeout: 10,
      command_timeout: 1000,
    }),
    file.yaml(
      ".config/dot-steward/app.yaml",
      file.compose(
        { app: { name: "demo", theme: "${theme}", features: ["a", "b"] } },
        { app: { features: ["x", "y"], retries: 3 } },
      ),
      { vars: { theme: "dark" } },
    ),
    file.from("examples/hello.txt", ".config/dot-steward/hello.txt", {
      mode: 0o644,
    }),
    exec.cmd("echo hello", "echo 'hello from dot-steward'"),
    shell_config.rc.build(),
    mise.global(["bun@latest"]),
    mise.pkg("node@lts"),
    mac_settings({
      mouse: { speed: 0.2 },
      dock: {
        autohide: false,
        tilesize: 60,
        largesize: 70,
        orientation: "bottom",
      },
    }),
    app_store.app(1502839586, { name: "Hand Mirror" }),
  ],
});

export default config(mac);
