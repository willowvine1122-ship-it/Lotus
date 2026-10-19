import { getSession } from "@/lib/server/auth";
import { getFile } from "@/lib/server/files";

/* An uploaded file, for the agency that owns it. Images and PDFs open inline; anything else downloads. */

const inline = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"]);

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session || session.role === "client") return new Response("Sign in to see this file.", { status: 401, headers: { "content-type": "text/plain; charset=utf-8" } });
  const file = await getFile(id);
  if (!file || file.agencyId !== session.agency?.id) return new Response("File not found.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  const name = encodeURIComponent(file.name);
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "content-type": file.type,
      "content-length": String(file.bytes.length),
      "content-disposition": `${inline.has(file.type) ? "inline" : "attachment"}; filename*=UTF-8''${name}`,
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "cache-control": "private, max-age=300",
    },
  });
}
