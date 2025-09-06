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
  out.push("│"); // leading line to attach the diamond visually
  out.push(`◆  ${title}`); // diamond at column 1
  // Line segment below the title (no extra blank line)
  out.push("│");
  for (const line of lines) {
    // If the line is a tree branch (├─/╰─/╭─), don't add an extra gutter
    if (
      line.startsWith("├─") ||
      line.startsWith("╰─") ||
      line.startsWith("╭─")
    ) {
      out.push(line);
    } else {
      out.push(`│  ${line}`);
    }
  }
  out.push("└");
  return out.join("\n");
}

// Convenience to render a simple single-line panel (no list)
export function renderPanelTitle(title: string): string {
  return ["│", `◆  ${title}`, "└"].join("\n");
}

// Render multiple titled sections in one continuous panel with a single gutter
// and one closing corner.
export function renderPanelSections(
  sections: Array<{ title: string; lines: string[] }>,
): string {
  const out: string[] = [];
  sections.forEach((s, idx) => {
    // Continue the gutter up to the diamond line (only once at the start)
    if (idx === 0) out.push("│");
    out.push(`◆  ${s.title}`); // diamond at column 1
    out.push("│"); // line segment (no blank line)
    for (const ln of s.lines) {
      // If the line is a tree branch (├─/╰─/╭─), don't add an extra gutter
      if (ln.startsWith("├─") || ln.startsWith("╰─") || ln.startsWith("╭─"))
        out.push(ln);
      else out.push(`│  ${ln}`);
    }
    // Spacer between sections (keeps line continuity)
    if (idx < sections.length - 1) out.push("│");
  });
  out.push("└");
  return out.join("\n");
}
