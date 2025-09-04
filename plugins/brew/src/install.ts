import { execCapture, findBrewCmd } from "./common.ts";

export async function isHomebrewInstalled(): Promise<boolean> {
  return (await findBrewCmd()) !== null;
}

export async function installHomebrewNonInteractive(): Promise<void> {
  const script =
    "curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh | NONINTERACTIVE=1 /bin/bash";
  const { ok, stderr } = await execCapture("/bin/bash", ["-lc", script], {
    env: { ...process.env, NONINTERACTIVE: "1" },
  });
  if (!ok) {
    throw new Error(
      `Homebrew installation failed. ${stderr ? `Details: ${stderr}` : ""}`,
    );
  }
  const path = await findBrewCmd();
  if (!path) {
    throw new Error(
      "Homebrew install script completed but brew command was not found.",
    );
  }
}
