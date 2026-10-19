/* Images an agency uploads for its sites and funnels: logos, favicons, photos. Shared by the upload route and the picker. */

export const ASSET_MAX_BYTES = 4 * 1024 * 1024;

export const ASSET_TYPES: Record<string, string> = {
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "image/webp": "WebP",
  "image/gif": "GIF",
  "image/svg+xml": "SVG",
  "image/x-icon": "ICO",
  "image/vnd.microsoft.icon": "ICO",
};

/** Ids of public assets carry this prefix, so the public route never serves a private form upload. */
export const ASSET_PREFIX = "asset-";

/** An uploaded image (/assets/…) or an https image link, with nothing that could break out of an attribute or url(). */
export const IMAGE_URL = /^(https:\/\/|\/assets\/)[^\s"'<>()\\]+$/;
