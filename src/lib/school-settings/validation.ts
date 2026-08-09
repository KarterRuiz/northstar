const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const HEX_DIGITS = /^[0-9A-Fa-f]{6}$/;

export function normalizeOptionalHexColor(value: string): string {
  const t = value.trim();
  if (!t) return "";
  const withHash = t.startsWith("#") ? t : `#${t}`;
  if (!HEX_COLOR.test(withHash)) return "";
  return withHash.toLowerCase();
}

export function isValidHexColor(value: string): boolean {
  const t = value.trim();
  if (t === "") return true;
  if (HEX_COLOR.test(t)) return true;
  return HEX_DIGITS.test(t);
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

/** Fallback when the browser omits MIME type (common for some SVG uploads). */
export function extensionForLogoFileName(fileName: string): string | null {
  const match = /\.([a-z0-9]+)$/i.exec(fileName.trim());
  if (!match) return null;
  switch (match[1].toLowerCase()) {
    case "png":
      return "png";
    case "jpg":
    case "jpeg":
      return "jpg";
    case "webp":
      return "webp";
    case "svg":
      return "svg";
    default:
      return null;
  }
}

export function resolveLogoExtension(file: { type: string; name: string }): string | null {
  return extensionForLogoMime(file.type) ?? extensionForLogoFileName(file.name);
}
