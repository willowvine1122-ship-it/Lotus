import "server-only";
import { db } from "./db";
import { currentWorkspace } from "./workspace";

/* Uploaded file bytes (form uploads, logos) live in lotus.files, outside the JSON modules. */

export async function putFile(id: string, name: string, type: string, bytes: Buffer) {
  const ws = currentWorkspace();
  if (!ws) throw new Error("Files are saved inside a workspace.");
  await db("file.put", { agency: ws.agencyId, id, name, type, base64: bytes.toString("base64") });
}

export async function getFile(id: string): Promise<{ agencyId: string; name: string; type: string; bytes: Buffer } | null> {
  const f = await db<{ agency_id: string; name: string; type: string; base64: string } | null>("file.get", { id });
  return f ? { agencyId: f.agency_id, name: f.name, type: f.type, bytes: Buffer.from(f.base64, "base64") } : null;
}

export async function removeFile(id: string) {
  const ws = currentWorkspace();
  if (!ws) return;
  await db("file.delete", { agency: ws.agencyId, id });
}
