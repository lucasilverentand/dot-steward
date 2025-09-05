import stringWidth from "string-width";

// Render a minimal clack-like panel with a title and a list of lines below.
// Example:
// │
// ◆  Apply this plan?
// │  <line 1>
// │  <line 2>
// └
export function renderPanelWithList(title: string, lines: string[]): string {
  const out: string[] = [];
  out.push("│");
  out.push(`◆  ${title}`);
  // Empty line below the title
  out.push("│  ");
  for (const line of lines) out.push(`│  ${line}`);
  out.push("└");
  return out.join("\n");
}

// Convenience to render a simple single-line panel (no list)
export function renderPanelTitle(title: string): string {
  return ["│", `◆  ${title}`, "└"].join("\n");
}
