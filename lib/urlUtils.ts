export function ensureAbsoluteUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = String(url).trim();
  if (!trimmed) return null;
  // Already absolute
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  // Protocol-relative
  if (/^\/\//.test(trimmed)) return `https:${trimmed}`;
  // Host without protocol (e.g. "example.framer.app/slug")
  return `https://${trimmed}`;
}
