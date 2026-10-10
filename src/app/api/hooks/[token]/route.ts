import { NextResponse } from "next/server";
import { receiveWebhook } from "@/lib/data/integrations";

/*
 * Incoming webhooks. Any tool (a website form, Typeform, Zapier, a CRM) can
 * POST JSON or form data here; the client's webhook settings decide how the
 * fields map onto a contact. Posting creates or updates the contact and
 * starts every workflow listening for this webhook.
 */

const MAX_BYTES = 256 * 1024;

async function readPayload(req: Request): Promise<unknown> {
  const text = await req.text();
  if (text.length > MAX_BYTES) throw new Error("too_large");
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/x-www-form-urlencoded")) return Object.fromEntries(new URLSearchParams(text));
  if (!text.trim()) return {};
  return JSON.parse(text);
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let payload: unknown;
  try {
    payload = await readPayload(req);
  } catch (err) {
    const tooLarge = err instanceof Error && err.message === "too_large";
    return NextResponse.json({ ok: false, error: tooLarge ? "Payload is larger than 256 KB" : "Send JSON or form data" }, { status: tooLarge ? 413 : 400 });
  }
  const r = receiveWebhook(new Date(), token, payload);
  return NextResponse.json(r.body, { status: r.status });
}

export function GET() {
  return NextResponse.json({ ok: false, error: "This is a Lotus webhook. Send a POST with JSON or form data." }, { status: 405, headers: { allow: "POST" } });
}
