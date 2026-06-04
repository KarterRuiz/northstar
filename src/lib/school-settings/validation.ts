const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export function normalizeOptionalHexColor(value: string): string {
  const t = value.trim();
  if (!t) return "";
  if (!HEX_COLOR.test(t)) return "";
  return t.toLowerCase();
}

export function isValidHexColor(value: string): boolean {
  const t = value.trim();
  return t === "" || HEX_COLOR.test(t);
}

export function extensionForLogoMime(mime: string): string | null {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/svg+xml":
      return "svg";
    default:
      return null;
  }
}
