import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { ASSET_MAX_BYTES, ASSET_PREFIX, ASSET_TYPES } from "@/lib/assets";
import { requireStaff } from "@/lib/server/auth";
import { putFile } from "@/lib/server/files";
import { origin } from "@/lib/server/invites";
import { withAgencyWorkspace } from "@/lib/server/workspace";

/* Staff: upload one image for a site or funnel. Multipart field "file". Answers with the public address to use. */

export async function POST(req: Request) {
  const session = await requireStaff();
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > ASSET_MAX_BYTES + 64 * 1024) return NextResponse.json({ error: "Images can be up to 4 MB." }, { status: 413 });
  const data = await req.formData().catch(() => null);
  const file = data?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
  if (!ASSET_TYPES[file.type]) return NextResponse.json({ error: "Use a PNG, JPG, WebP, GIF, SVG or ICO image." }, { status: 415 });
  if (file.size === 0) return NextResponse.json({ error: "That file is empty." }, { status: 400 });
  if (file.size > ASSET_MAX_BYTES) return NextResponse.json({ error: "Images can be up to 4 MB." }, { status: 413 });
  const id = `${ASSET_PREFIX}${randomUUID()}`;
  const name = file.name.replace(/[^\w.\- ()]/g, "_").slice(0, 120) || "image";
  const bytes = Buffer.from(await file.arrayBuffer());
  await withAgencyWorkspace(session.agency.id, session, () => putFile(id, name, file.type, bytes));
  const base = await origin();
  // Pages need a full https address (share images, custom domains); local development gets a site path.
  const url = base.startsWith("https://") ? `${base}/assets/${id}` : `/assets/${id}`;
  return NextResponse.json({ id, url, name }, { status: 201 });
}
