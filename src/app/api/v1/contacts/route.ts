import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUpsertContact, authenticate, contactPayload, logApiCall } from "@/lib/data/integrations";
import { listContacts } from "@/lib/data/store";

/*
 * Lotus REST API, contacts. Authenticate with a client's API key:
 *   Authorization: Bearer lts_…
 * GET lists the client's contacts (newest first, ?email= to find one,
 * ?limit= up to 100). POST creates a contact, or fills in the one with the
 * same email or phone.
 */

const unauthorized = () => NextResponse.json({ ok: false, error: "Send a valid API key as “Authorization: Bearer lts_…”. Create one in Lotus › Integrations › API keys." }, { status: 401 });

export async function GET(req: Request) {
  const now = new Date();
  const key = authenticate(now, req.headers.get("authorization"));
  if (!key) return unauthorized();
  const url = new URL(req.url);
  const email = url.searchParams.get("email")?.toLowerCase();
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));
  const rows = listContacts(now, key.accountId)
    .filter((c) => !email || c.email?.toLowerCase() === email)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
  logApiCall(now, key, "GET /api/v1/contacts", 200, `Listed ${rows.length} contacts`);
  return NextResponse.json({ ok: true, data: rows.map((c) => contactPayload(now, c)) });
}

const body = z.object({
  first_name: z.string().trim().max(80).optional(),
  last_name: z.string().trim().max(80).optional(),
  email: z.email().max(200).optional(),
  phone: z.string().trim().max(40).optional(),
  company: z.string().trim().max(120).optional(),
  city: z.string().trim().max(80).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});

export async function POST(req: Request) {
  const now = new Date();
  const key = authenticate(now, req.headers.get("authorization"));
  if (!key) return unauthorized();
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !(parsed.data.email || parsed.data.phone)) {
    const error = parsed.success ? "Send an email or a phone number" : parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    logApiCall(now, key, "POST /api/v1/contacts", 422, error);
    return NextResponse.json({ ok: false, error }, { status: 422 });
  }
  const d = parsed.data;
  const r = apiUpsertContact(now, key.accountId, { firstName: d.first_name, lastName: d.last_name, email: d.email, phone: d.phone, company: d.company, city: d.city }, d.tags ?? []);
  if (!r.contact) return NextResponse.json({ ok: false, error: "Could not create the contact" }, { status: 500 });
  logApiCall(now, key, "POST /api/v1/contacts", r.created ? 201 : 200, `${r.created ? "Created" : "Updated"} ${r.contact.firstName} ${r.contact.lastName}`, r.contact.id);
  return NextResponse.json({ ok: true, created: r.created, data: contactPayload(now, r.contact) }, { status: r.created ? 201 : 200 });
}
