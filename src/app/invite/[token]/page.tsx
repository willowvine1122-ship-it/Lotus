import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { acceptInviteAction } from "@/app/account/actions";
import { AuthFrame } from "@/components/account/auth-frame";
import { AcceptInviteForm } from "@/components/account/auth-forms";
import { getSession, normalEmail, sha256 } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

export const metadata = { title: "Join on Lotus", robots: { index: false } };

interface InviteRow {
  invite: { email: string; name: string; role: "admin" | "member" | "client" };
  agency_name: string;
}

const roleLine = { admin: "as an admin", member: "as a team member", client: "to see your dashboard" } as const;

async function Body({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await connection();
  const row = await db<InviteRow | null>("invite.get", { token_hash: sha256(token) });
  if (!row) {
    return (
      <AuthFrame title="This invite has expired" sub="It was already used, withdrawn, or it's more than 7 days old. Ask whoever invited you for a new link.">
        <Link href="/login" className="text-sm font-medium text-brand hover:underline">
          Go to sign in
        </Link>
      </AuthFrame>
    );
  }
  const { invite, agency_name } = row;
  const session = await getSession();
  const existing = await db<{ id: string } | null>("user.by_email", { email: invite.email });
  const mode = session && normalEmail(session.user.email) === normalEmail(invite.email) ? "signed-in" : existing ? "existing" : "new";
  return (
    <AuthFrame title={`Join ${agency_name}`} sub={`You've been invited ${roleLine[invite.role]}.`}>
      {session && mode !== "signed-in" && (
        <p className="mb-4 rounded border border-amber/25 bg-amber-soft/60 px-3 py-2 text-xs text-amber">
          You&apos;re signed in as {session.user.email}. Accepting signs you in as {invite.email} instead.
        </p>
      )}
      <AcceptInviteForm action={acceptInviteAction.bind(null, token)} email={invite.email} mode={mode} defaultName={invite.name || undefined} />
    </AuthFrame>
  );
}

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={<AuthFrame title="Opening your invite…">{null}</AuthFrame>}>
      <Body params={params} />
    </Suspense>
  );
}
