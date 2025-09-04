import { os, all, any, config, hostname, profile } from "@dot-steward/core";
import { brew } from "../plugins/brew/src";

const mac_base = profile({
  name: "mac-base",
  matches: os("darwin"),
});

const mac_dev = profile({
  name: "mac-dev",
  matches: all(os("darwin"), any(hostname("mac"), hostname("macbook"))),
  items: [
    brew.formula("some-formula"),
  ],
});

export default config({
  profiles: [mac_base, mac_dev],
});
