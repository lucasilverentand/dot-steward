import { os, all, any, config, hostname, profile } from "@dot-steward/core";
import { brew } from "../plugins/brew/src";
import { cfg } from "../plugins/config/src";
import { shell } from "../plugins/shell/src";

const cask = brew.tap("homebrew/cask");

const mac_base = profile({
  name: "mac-base",
  matches: os("darwin"), 
  items: [
    brew.formula("cowsay"),
    cask.cask("google-chrome"),
    cask.cask("firefox"),
    // Example: compose YAML config to an example path in repo
    cfg.yaml(
      "examples/out/app.yaml",
      cfg.compose(
        { app: { name: "demo", theme: "${theme}", features: ["a", "b"] } },
        { app: { features: ["x", "y"], retries: 3 } },
      ),
      { vars: { theme: "dark" } },
    ),
    // Example shell commands
    shell.cmd("echo hello", "echo 'hello from dot-steward'"),
    shell.always(
      "create sample file",
      "mkdir -p examples/out && echo 'data' > examples/out/hello.txt",
      // optional cleanup example could be added via shell.cmd with cleanup
    ),
  ].flat(),
});

const mac_dev = profile({
  name: "mac-dev",
  matches: all(os("darwin"), any(hostname("mac"), hostname("macbook"))),
});

export default config({
  profiles: [mac_base, mac_dev],
});
