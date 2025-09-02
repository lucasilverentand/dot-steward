/**
 * Postinstall script to globally link the CLI for local development.
 * - Skips in CI environments.
 * - Gracefully handles errors and prints actionable messages.
 */

const isCI =
  Boolean(process.env.CI) || /true|1|yes/i.test(process.env.CI ?? "");

async function main() {
  if (isCI) {
    console.log("[postinstall] CI detected; skipping CLI link.");
    return;
  }

  // Ensure we're running with Bun
  if (typeof Bun === "undefined") {
    console.warn(
      "[postinstall] Bun runtime not detected; cannot link CLI automatically.",
    );
    return;
  }

  console.log("[postinstall] Linking @dot-steward/cli globally (bun link)...");
  const proc = Bun.spawn(["bun", "-C", "packages/cli", "link"], {
    stdout: "inherit",
    stderr: "inherit",
  });
  const code = await proc.exited;

  if (code === 0) {
    console.log(
      "[postinstall] Linked. Ensure ~/.bun/bin is on PATH, then run: stew",
    );
  } else {
    console.warn(
      "[postinstall] Failed to link CLI automatically. You can run it manually:",
    );
    console.warn("  bun -C packages/cli link");
  }
}

main().catch((err) => {
  console.error("[postinstall] Unexpected error while linking CLI:\n", err);
});
