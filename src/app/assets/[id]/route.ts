import { ASSET_PREFIX, ASSET_TYPES } from "@/lib/assets";
import { getFile } from "@/lib/server/files";

/* Public: an image an agency uploaded for its sites and funnels. Ids are random and never reused, so it caches for good. */

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const file = id.startsWith(ASSET_PREFIX) ? await getFile(id) : null;
  if (!file || !ASSET_TYPES[file.type]) return new Response("Not found.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "content-type": file.type,
      "content-length": String(file.bytes.length),
      "x-content-type-options": "nosniff",
      // An SVG opened on its own can't run script or load anything.
      "content-security-policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
      "cache-control": "public, max-age=31536000, immutable",
      "access-control-allow-origin": "*",
    },
  });
}
