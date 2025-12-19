export function nowIso(): string {
  return new Date().toISOString();
}

export function safeFilename(name: string, fallback = "download.bin"): string {
  const trimmed = (name || "").trim();
  if (!trimmed) return fallback;
  // Very conservative: keep basic chars only
  return trimmed.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 180) || fallback;
}

export function parseCsvList(value: string | undefined | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getClientIp(request: Request): string | null {
  // Cloudflare provides CF-Connecting-IP
  return request.headers.get("CF-Connecting-IP") || request.headers.get("x-forwarded-for");
}

export function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  return crypto.subtle.digest("SHA-256", enc).then((buf) =>
    [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("")
  );
}

export function sha256HexBytes(input: ArrayBuffer | ArrayBufferView): Promise<string> {
  const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  return crypto.subtle.digest("SHA-256", bytes).then((buf) =>
    [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("")
  );
}

export function randomTokenBase64Url(bytes = 32): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  let s = btoa(String.fromCharCode(...a));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function jitterSeconds(base: number, jitter: number): number {
  return base + Math.floor(Math.random() * Math.max(0, jitter));
}
