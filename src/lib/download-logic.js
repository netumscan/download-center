/**
 * Parse HTTP range header. Returns {start,end} inclusive or null when invalid.
 * Keep JS-only so Node test runner can import without TS tooling.
 */
export function parseRange(range, size) {
  if (!range) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!m) return null;
  const startStr = m[1];
  const endStr = m[2];
  let start;
  let end;

  if (startStr === "" && endStr !== "") {
    const n = Number(endStr);
    if (!Number.isFinite(n) || n <= 0) return null;
    start = Math.max(0, size - n);
    end = size - 1;
    return { start, end };
  }

  start = Number(startStr);
  end = endStr ? Number(endStr) : size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0 || end < start || start >= size) return null;
  end = Math.min(end, size - 1);
  return { start, end };
}

export function hostFromUrl(u) {
  try {
    return new URL(u).host.toLowerCase();
  } catch {
    return null;
  }
}

export function parseAllowlist(csv) {
  if (!csv) return [];
  return csv
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}
