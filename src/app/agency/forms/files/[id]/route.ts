import { findFile } from "@/lib/data/forms";

/* An uploaded file, for the agency. Images and PDFs open inline; anything else downloads. */

const inline = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"]);

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const file = findFile(new Date(), id);
  if (!file?.bytes) return new Response(id.startsWith("demo-") ? "Sample responses don't carry real files." : "File not found.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  const name = encodeURIComponent(file.name);
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "content-type": file.type,
      "content-length": String(file.size),
      "content-disposition": `${inline.has(file.type) ? "inline" : "attachment"}; filename*=UTF-8''${name}`,
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "cache-control": "private, max-age=300",
    },
  });
}
