// Simple CLI table renderer with unicode borders
// Usage: console.log(renderTable(["Col1", "Col2"], [["a", "b"], [1, true]]));

function toCell(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
}

function pad(str: string, len: number): string {
  const s = str;
  const diff = len - s.length;
  if (diff <= 0) return s;
  return s + " ".repeat(diff);
}

function getTTYWidth(): number {
  const w =
    (process.stdout &&
      (process.stdout as unknown as { columns?: number; isTTY?: boolean })
        .columns) ||
    0;
  return w && w > 0 ? w : 80;
}

function cropVisible(input: string, maxLen: number): string {
  const visible = stripAnsi(input);
  if (maxLen <= 0) return "";
  if (visible.length <= maxLen) return input;
  if (maxLen <= 1) return "…"; // as much as we can show
  const slice = `${visible.slice(0, maxLen - 1)}…`;
  // We dropped ANSI codes; safe because we apply styles after cropping normally.
  return slice;
}

export function renderTable(
  headers: string[],
  rows: Array<Array<unknown>>,
): string {
  const h = headers.map((s) => toCell(s));
  const data = rows.map((r) => r.map((c) => toCell(c)));

  const cols = Math.max(h.length, ...data.map((r) => r.length));
  let widths = Array.from({ length: cols }, (_, i) => {
    const headerLen = h[i] ? stripAnsi(h[i]).length : 0;
    const colLen = Math.max(
      0,
      ...data.map((r) => (r[i] ? stripAnsi(r[i]).length : 0)),
    );
    return Math.max(headerLen, colLen);
  });

  // Fit into terminal width using border math:
  // top/bottom length = sum(widths) + 3*cols + 1
  const maxTotal = getTTYWidth();
  const current = widths.reduce((a, b) => a + b, 0);
  let available = Math.max(1, maxTotal - (3 * cols + 1));
  if (current > available) {
    // Proportionally shrink columns, with a minimum of 3 each
    const minCol = 3;
    const totalMin = minCol * cols;
    available = Math.max(totalMin, available);
    const scale = (available - totalMin) / Math.max(1, current - totalMin);
    widths = widths.map((w) =>
      Math.max(minCol, Math.floor(minCol + (w - minCol) * scale)),
    );
  }

  const top = `┌${widths.map((w) => "─".repeat(w + 2)).join("┬")}┐`;
  const sep = `├${widths.map((w) => "─".repeat(w + 2)).join("┼")}┤`;
  const bot = `└${widths.map((w) => "─".repeat(w + 2)).join("┴")}┘`;

  const renderRow = (r: string[]) => {
    const cells = widths.map((w, i) => pad(cropVisible(r[i] ?? "", w), w));
    return `│ ${cells.join(" │ ")} │`;
  };

  const lines: string[] = [];
  lines.push(top);
  lines.push(renderRow(h));
  lines.push(sep);
  for (const r of data) lines.push(renderRow(r));
  lines.push(bot);
  return lines.join("\n");
}

// Strip ANSI escape codes for accurate width calculations
function stripAnsi(input: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ESC codes are legitimate here
  const ansiRe = /\x1B\[[0-9;]*m/g;
  return input.replace(ansiRe, "");
}

function padLeft(str: string, len: number): string {
  const s = str;
  const diff = len - s.length;
  if (diff <= 0) return s;
  return " ".repeat(diff) + s;
}

function padRight(str: string, len: number): string {
  const s = str;
  const diff = len - s.length;
  if (diff <= 0) return s;
  return s + " ".repeat(diff);
}

// Render a simple key/value box:
// - rounded outer border
// - no inner borders
// - label (key) right-aligned and optionally dim
export function renderKeyValueBox(
  rows: Array<[unknown, unknown]>,
  opts?: {
    gap?: number;
    padding?: number;
    dimLabels?: boolean;
    title?: string;
    titleDim?: boolean;
    titleAlign?: "left" | "center";
    maxWidth?: number; // total box width including borders
    valueMax?: number; // optional clamp for value column width
    labelMax?: number; // optional clamp for label column width
    footerLines?: string[]; // optional footer rendered full-width beneath rows
    footerDim?: boolean;
    border?: "box" | "none"; // box (default) or borderless
  },
): string {
  const gap = opts?.gap ?? 2; // spaces between label and value
  const padding = opts?.padding ?? 1; // spaces inside left/right borders
  const dimOn = opts?.dimLabels ?? true;
  const border = opts?.border ?? "box";
  const titleAlign = opts?.titleAlign ?? "center";
  const DIM = "\x1b[2m"; // faint
  const RESET_DIM = "\x1b[22m";

  const data = rows.map(([k, v]) => [toCell(k), toCell(v)] as [string, string]);
  let labelWidth = Math.max(0, ...data.map(([k]) => stripAnsi(k).length));
  let valueWidth = Math.max(0, ...data.map(([, v]) => stripAnsi(v).length));
  if (opts?.labelMax && opts.labelMax > 0)
    labelWidth = Math.min(labelWidth, opts.labelMax);
  if (opts?.valueMax && opts.valueMax > 0)
    valueWidth = Math.min(valueWidth, opts.valueMax);
  const borderWidth = border === "box" ? 2 : 0; // left/right borders
  const maxTotal = Math.max(10, Math.min(200, opts?.maxWidth ?? getTTYWidth()));
  const maxInside = Math.max(1, maxTotal - borderWidth);
  let insideWidth = padding + labelWidth + gap + valueWidth + padding;

  if (insideWidth > maxInside) {
    // Shrink columns proportionally with minima
    const minLabel = 3;
    const minValue = 3;
    const contentBudget = Math.max(1, maxInside - padding - padding - gap);
    const minTotal = minLabel + minValue;
    const alloc = Math.max(minTotal, contentBudget);
    const total = labelWidth + valueWidth;
    const labelAlloc = Math.max(
      minLabel,
      Math.floor((labelWidth / Math.max(1, total)) * alloc),
    );
    const valueAlloc = Math.max(minValue, alloc - labelAlloc);
    labelWidth = labelAlloc;
    valueWidth = valueAlloc;
    insideWidth = padding + labelWidth + gap + valueWidth + padding;
  }

  const top = border === "box" ? `╭${"─".repeat(insideWidth)}╮` : "";
  const bot = border === "box" ? `╰${"─".repeat(insideWidth)}╯` : "";

  function wrapText(text: string, width: number): string[] {
    const vis = stripAnsi(text);
    if (width <= 0) return [""];
    if (vis.length <= width) return [text];
    const words = vis.split(/\s+/g);
    const lines: string[] = [];
    let current = "";
    const pushLine = () => {
      lines.push(current);
      current = "";
    };
    for (const w of words) {
      if (w.length > width) {
        // break long word
        if (current.length > 0) pushLine();
        for (let i = 0; i < w.length; i += width) {
          lines.push(w.slice(i, i + width));
        }
        continue;
      }
      if (current.length === 0) {
        current = w;
      } else if (current.length + 1 + w.length <= width) {
        current += ` ${w}`;
      } else {
        pushLine();
        current = w;
      }
    }
    if (current.length > 0) pushLine();
    return lines.length ? lines : [""];
  }

  const lines: string[] = [];
  if (top) lines.push(top);
  if (opts?.title && opts.title.length > 0) {
    const rawTitle = stripAnsi(opts.title);
    const cropped = cropVisible(rawTitle, insideWidth);
    const titleText = opts.titleDim ? `\x1b[2m${cropped}\x1b[22m` : cropped;
    const titleLen = stripAnsi(cropped).length;
    const left =
      titleAlign === "left"
        ? 0
        : Math.max(0, Math.floor((insideWidth - titleLen) / 2));
    const right = Math.max(0, insideWidth - titleLen - left);
    if (border === "box")
      lines.push(`│${" ".repeat(left)}${titleText}${" ".repeat(right)}│`);
    else lines.push(`${" ".repeat(left)}${titleText}${" ".repeat(right)}`);
  }
  for (const [rawK, rawV] of data) {
    const labelBase = padLeft(cropVisible(rawK, labelWidth), labelWidth);
    const chunks = String(rawV).split("\n");
    const valueLines = chunks.flatMap((chunk) => wrapText(chunk, valueWidth));
    for (let i = 0; i < valueLines.length; i++) {
      const val = padRight(valueLines[i], valueWidth);
      const lab = i === 0 ? labelBase : " ".repeat(labelWidth);
      const labelOut = dimOn ? `${DIM}${lab}${RESET_DIM}` : lab;
      const content = `${" ".repeat(padding)}${labelOut}${" ".repeat(gap)}${val}${" ".repeat(padding)}`;
      lines.push(border === "box" ? `│${content}│` : content);
    }
  }
  // Footer: render lines full-width (label + gap + value area)
  if (opts?.footerLines && opts.footerLines.length > 0) {
    const contentWidth = labelWidth + gap + valueWidth;
    const dimFooter = opts.footerDim ?? false;
    // Only draw separator if boxed
    if (border === "box" && data.length > 0) {
      const sep = `\x1b[2m${"─".repeat(contentWidth)}\x1b[22m`;
      lines.push(`│${" ".repeat(padding)}${sep}${" ".repeat(padding)}│`);
    }
    for (const footerLine of opts.footerLines) {
      const parts = String(footerLine).split("\n");
      for (const part of parts) {
        const segs = wrapText(part, contentWidth);
        for (const seg of segs) {
          const padded = padRight(seg, contentWidth);
          const out = dimFooter ? `\x1b[2m${padded}\x1b[22m` : padded;
          const content = `${" ".repeat(padding)}${out}${" ".repeat(padding)}`;
          lines.push(border === "box" ? `│${content}│` : content);
        }
      }
    }
  }
  if (bot) lines.push(bot);
  return lines.join("\n");
}

// Render a single-column list in a rounded box with optional title
export function renderListBox(
  items: Array<unknown>,
  opts?: {
    padding?: number;
    title?: string;
    dimItems?: boolean;
    bullet?: string;
    maxWidth?: number; // total box width including borders
    border?: "box" | "none";
    titleAlign?: "left" | "center";
  },
): string {
  const padding = opts?.padding ?? 1;
  const dimOn = opts?.dimItems ?? false;
  const bullet = opts?.bullet ?? "• ";
  const border = opts?.border ?? "box";
  const titleAlign = opts?.titleAlign ?? "center";
  const DIM = "\x1b[2m";
  const RESET_DIM = "\x1b[22m";

  const rows = items.map((it) => bullet + toCell(it));
  const ttyWidth = Math.max(10, Math.min(200, opts?.maxWidth ?? getTTYWidth()));
  const borderWidth = border === "box" ? 2 : 0;
  const maxInside = Math.max(1, ttyWidth - borderWidth);
  // First, estimate width; then clamp to terminal
  const contentWidth = Math.max(
    0,
    ...rows.map((r) => stripAnsi(r).length),
    opts?.title ? stripAnsi(opts.title).length : 0,
  );
  const estimatedInside = padding + contentWidth + padding;
  const insideWidth = Math.min(maxInside, Math.max(1, estimatedInside));

  const top = border === "box" ? `╭${"─".repeat(insideWidth)}╮` : "";
  const bot = border === "box" ? `╰${"─".repeat(insideWidth)}╯` : "";

  const lines: string[] = [];
  if (top) lines.push(top);
  if (opts?.title && opts.title.length > 0) {
    const croppedTitle = cropVisible(opts.title, insideWidth);
    const titleText = croppedTitle;
    const titleLen = stripAnsi(croppedTitle).length;
    const left =
      titleAlign === "left"
        ? 0
        : Math.max(0, Math.floor((insideWidth - titleLen) / 2));
    const right = Math.max(0, insideWidth - titleLen - left);
    lines.push(
      border === "box"
        ? `│${" ".repeat(left)}${titleText}${" ".repeat(right)}│`
        : `${" ".repeat(left)}${titleText}${" ".repeat(right)}`,
    );
  }
  for (const r of rows) {
    const allowed = Math.max(0, insideWidth - padding - padding);
    const cropped = cropVisible(r, allowed);
    const visibleLen = stripAnsi(cropped).length;
    const rightPad = Math.max(0, allowed - visibleLen);
    const text = dimOn ? `${DIM}${cropped}${RESET_DIM}` : cropped;
    const content = `${" ".repeat(padding)}${text}${" ".repeat(rightPad)}${" ".repeat(padding)}`;
    lines.push(border === "box" ? `│${content}│` : content);
  }
  if (bot) lines.push(bot);
  return lines.join("\n");
}

// Render key/value pairs arranged in a grid of N columns within a rounded box.
// Each column shows one key:value pair; rows are filled left-to-right.
export function renderKeyValueGridBox(
  pairs: Array<[unknown, unknown]>,
  opts?: {
    columns?: number; // default 2
    gap?: number; // spaces between label and value within a column
    colGap?: number; // spaces between columns
    padding?: number; // spaces inside left/right borders
    dimLabels?: boolean;
    title?: string;
    titleAlign?: "left" | "center";
    maxWidth?: number; // total width including borders
    labelMax?: number;
    valueMax?: number;
    border?: "box" | "none";
  },
): string {
  const cols = Math.max(1, opts?.columns ?? 2);
  const gap = Math.max(1, opts?.gap ?? 2);
  const colGap = Math.max(2, opts?.colGap ?? 2);
  const padding = Math.max(0, opts?.padding ?? 1);
  const dimOn = opts?.dimLabels ?? true;
  const border = opts?.border ?? "box";
  const titleAlign = opts?.titleAlign ?? "center";
  const DIM = "\x1b[2m";
  const RESET_DIM = "\x1b[22m";

  const data = pairs.map(
    ([k, v]) => [toCell(k), toCell(v)] as [string, string],
  );
  const rows = Math.ceil(data.length / cols);

  // Compute per-column widths from items that land in that column
  const labelW: number[] = Array.from({ length: cols }, () => 0);
  const valueW: number[] = Array.from({ length: cols }, () => 0);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (idx >= data.length) continue;
      const [k, v] = data[idx];
      labelW[c] = Math.max(labelW[c], stripAnsi(k).length);
      valueW[c] = Math.max(valueW[c], stripAnsi(v).length);
    }
  }
  if (opts?.labelMax && opts.labelMax > 0) {
    for (let c = 0; c < cols; c++)
      labelW[c] = Math.min(labelW[c], opts.labelMax);
  }
  if (opts?.valueMax && opts.valueMax > 0) {
    for (let c = 0; c < cols; c++)
      valueW[c] = Math.min(valueW[c], opts.valueMax);
  }

  // Collapse into column content widths
  const colW = labelW.map((lw, i) => lw + gap + valueW[i]);

  // Fit into terminal width
  const borderWidth = border === "box" ? 2 : 0; // left/right
  const tty = Math.max(10, Math.min(200, opts?.maxWidth ?? getTTYWidth()));
  const maxInside = Math.max(1, tty - borderWidth);
  const staticSpaces = padding + (cols - 1) * colGap + padding;
  let available = Math.max(1, maxInside - staticSpaces);
  const sumCol = colW.reduce((a, b) => a + b, 0);
  if (sumCol > available) {
    const minLabel = 3;
    const minValue = 3;
    const minCol = minLabel + gap + minValue;
    const minTotal = minCol * cols;
    available = Math.max(minTotal, available);
    const scale = (available - minTotal) / Math.max(1, sumCol - minTotal);
    for (let i = 0; i < cols; i++) {
      const tgt = Math.floor(minCol + (colW[i] - minCol) * scale);
      colW[i] = Math.max(minCol, tgt);
    }
    // Recompute label/value split per column proportionally
    for (let i = 0; i < cols; i++) {
      const content = colW[i] - gap;
      const totalOrig = Math.max(1, labelW[i] + valueW[i]);
      const labAlloc = Math.max(
        3,
        Math.floor((labelW[i] / totalOrig) * content),
      );
      const valAlloc = Math.max(3, content - labAlloc);
      labelW[i] = labAlloc;
      valueW[i] = valAlloc;
    }
  }

  const insideWidth = staticSpaces + colW.reduce((a, b) => a + b, 0);
  const top = border === "box" ? `╭${"─".repeat(insideWidth)}╮` : "";
  const bot = border === "box" ? `╰${"─".repeat(insideWidth)}╯` : "";

  const lines: string[] = [];
  if (top) lines.push(top);
  if (opts?.title && opts.title.length > 0) {
    const croppedTitle = cropVisible(opts.title, insideWidth);
    const titleLen = stripAnsi(croppedTitle).length;
    const left =
      titleAlign === "left"
        ? 0
        : Math.max(0, Math.floor((insideWidth - titleLen) / 2));
    const right = Math.max(0, insideWidth - titleLen - left);
    lines.push(
      border === "box"
        ? `│${" ".repeat(left)}${croppedTitle}${" ".repeat(right)}│`
        : `${" ".repeat(left)}${croppedTitle}${" ".repeat(right)}`,
    );
  }
  for (let r = 0; r < rows; r++) {
    let rowText = "";
    for (let c = 0; c < cols; c++) {
      if (c > 0) rowText += " ".repeat(colGap);
      const idx = r * cols + c;
      if (idx >= data.length) {
        rowText += " ".repeat(colW[c]);
        continue;
      }
      const [k, v] = data[idx];
      const lab = padLeft(cropVisible(k, labelW[c]), labelW[c]);
      const val = padRight(cropVisible(v, valueW[c]), valueW[c]);
      const labOut = dimOn ? `${DIM}${lab}${RESET_DIM}` : lab;
      rowText += labOut + " ".repeat(gap) + val;
    }
    const content = `${" ".repeat(padding)}${rowText}${" ".repeat(padding)}`;
    lines.push(border === "box" ? `│${content}│` : content);
  }
  if (bot) lines.push(bot);
  return lines.join("\n");
}
