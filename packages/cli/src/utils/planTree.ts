import type { PanelSection } from "./planSections.ts";

// Render a main section (e.g., "Plan") with tree-style subsections and bullets.
// Uses proper box-drawing characters: ╭ ├ ╰ ─ │ and • for bullets.
export function renderPlanTree(title: string, subs: PanelSection[]): string {
  const out: string[] = [];
  const V = "│"; // vertical
  const T = "├"; // tee
  const C = "╭"; // corner (top)
  const L = "╰"; // corner (bottom)
  const H = "─"; // horizontal

  out.push(`${C}${H} ${title}`);
  if (subs.length === 0) {
    out.push(L); // empty tree
    return out.join("\n");
  }
  out.push(V); // spacer under the title

  subs.forEach((s, idx) => {
    const last = idx === subs.length - 1;
    const branch = last ? L : T;
    out.push(`${branch}${H} ${s.title}`);
    const gutter = last ? "   " : `${V}  `;
    // Do not add an extra bullet; lines may already include indicators
    for (const ln of s.lines) out.push(`${gutter}${ln}`);
    if (!last) out.push(V); // spacer between subsections
  });
  return out.join("\n");
}

// Render only the subsections as a tree suitable for inclusion inside
// a panel gutter (no leading corner/diamond).
export function renderTreeSubsections(subs: PanelSection[]): string[] {
  const lines: string[] = [];
  // Do not render an inner vertical; the outer panel supplies the gutter.
  const V = "";
  const T = "├";
  // Intentionally avoid using the bottom corner for the last subsection
  // to keep the panel's final corner/summary visually distinct.
  // const L = "╰";
  const H = "─";
  subs.forEach((s, idx) => {
    const last = idx === subs.length - 1;
    // Use tee for all subsections (no corner on the last one)
    const branch = T;
    lines.push(`${branch}${H} ${s.title}`);
    // Let the outer panel provide the gutter spacing; avoid extra indent here
    const gutter = "";
    // Do not add an extra bullet; lines may already include indicators
    for (const ln of s.lines) lines.push(`${gutter}${ln}`);
    // Add a blank spacer line between subsections for readability
    if (!last) lines.push("");
  });
  return lines;
}
