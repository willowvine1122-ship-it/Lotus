import { NextResponse } from "next/server";
import { findFormBySlug, MAX_FILE_BYTES, storeFile } from "@/lib/data/forms";
import { withPublicWorkspace } from "@/lib/server/workspace";

/* Public: one file for a file-upload question on a live form. Multipart: file, questionId. */

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_FILE_BYTES + 64 * 1024) return NextResponse.json({ error: "Files can be up to 4 MB." }, { status: 413 });
  const data = await req.formData().catch(() => null);
  const file = data?.get("file");
  const questionId = data?.get("questionId");
  if (!(file instanceof File) || typeof questionId !== "string") return NextResponse.json({ error: "Send a file and the question it answers." }, { status: 400 });
  const bytes = Buffer.from(await file.arrayBuffer());
  const res = await withPublicWorkspace(`form:${slug}`, async () => {
    const now = new Date();
    const form = findFormBySlug(now, slug);
    if (!form || form.status !== "live") return NextResponse.json({ error: "This form isn't taking files." }, { status: 404 });
    const result = await storeFile(now, form.id, questionId, { name: file.name, type: file.type, bytes });
    if ("error" in result) return NextResponse.json(result, { status: 422 });
    return NextResponse.json(result, { status: 201 });
  });
  return res ?? NextResponse.json({ error: "This form isn't taking files." }, { status: 404 });
}
