// Normalize AggregateError-like structures into a simple array
// of { id, error } where message format is "<uuid>: <detail>" when available.
export function collectAggregateErrors(
  err: unknown,
): Array<{ id: string; error: string }> {
  const errors: Array<{ id: string; error: string }> = [];
  const isAgg =
    !!err &&
    typeof err === "object" &&
    "errors" in (err as Record<string, unknown>);
  if (isAgg) {
    const subs = (err as unknown as AggregateError).errors ?? [];
    for (const se of subs) {
      const msg = se instanceof Error ? se.message : String(se);
      const m = msg.match(/^([0-9a-fA-F-]{36}):\s*(.*)$/);
      const id = m?.[1] ?? "";
      const detail = m?.[2] ?? msg;
      errors.push({ id, error: detail });
    }
  } else if (err instanceof Error) {
    errors.push({ id: "", error: err.message });
  } else if (err !== undefined) {
    errors.push({ id: "", error: String(err) });
  }
  return errors;
}
