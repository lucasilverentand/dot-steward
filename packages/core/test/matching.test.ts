import { expect, test } from "bun:test";
import {
  type HostContextLike,
  all,
  any,
  arch,
  env_var,
  evalMatchExpr,
  home,
} from "../src/host/matching.ts";

const ctx: HostContextLike = {
  os: "linux",
  arch: "x86_64",
  hostname: "example",
  env: { variables: { FOO: "bar" }, ci: false, devcontainer: false },
  user: {
    name: "alice",
    uid: "1000",
    gid: "1000",
    home: "/home/alice",
    can_sudo: true,
    is_root: false,
  },
};

test("matches architecture", () => {
  expect(evalMatchExpr(ctx, arch("x86_64"))).toBe(true);
  expect(evalMatchExpr(ctx, arch("arm64"))).toBe(false);
});

test("all and any expressions", () => {
  expect(evalMatchExpr(ctx, all(arch("x86_64"), home("/home/alice")))).toBe(
    true,
  );
  expect(evalMatchExpr(ctx, any(arch("arm64"), home("/home/bob")))).toBe(false);
});

test("environment variable conditions", () => {
  expect(evalMatchExpr(ctx, env_var("FOO"))).toBe(true);
  expect(evalMatchExpr(ctx, env_var("BAR"))).toBe(false);
  expect(evalMatchExpr(ctx, env_var("FOO", "bar"))).toBe(true);
  expect(evalMatchExpr(ctx, env_var("FOO", "baz"))).toBe(false);
});
