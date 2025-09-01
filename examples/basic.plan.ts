import {
  plan,
  profile,
  apt,
  brew,
  command,
  file,
  shell,
} from "@dot-steward/dot-steward";

export const basicPlan = plan({
  profiles: [
    profile("base", {
      items: [
        command.cmd("check-git", "command -v git", "sudo apt-get update"),
        file.ensure(
          "gitconfig",
          "~/.gitconfig",
          "[user]\n  name = Example\n  email = example@example.com\n",
        ),
        shell.env("editor", "EDITOR", "vim"),
        shell.path("localBin", "~/.local/bin"),
      ],
    }),
    profile("linux", {
      match: { os: "linux" },
      items: [apt.pkg("curl"), apt.pkg("htop")],
    }),
    profile("mac", {
      match: { os: "darwin" },
      items: [
        brew.tap("homebrew/cask"),
        brew.formula("wget"),
        brew.cask("visual-studio-code"),
      ],
    }),
  ],
});
