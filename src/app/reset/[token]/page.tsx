import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { resetPasswordAction } from "@/app/account/actions";
import { AuthFrame } from "@/components/account/auth-frame";
import { ResetPasswordForm } from "@/components/account/auth-forms";
import { resetTokenEmail, resetTokenMatches } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

export const metadata = { title: "Choose a new password", robots: { index: false } };

async function Body({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await connection();
  const addr = resetTokenEmail(token);
  const user = addr ? await db<{ email: string; password_hash: string } | null>("user.by_email", { email: addr }) : null;
  if (!user || !resetTokenMatches(token, user.password_hash)) {
    return (
      <AuthFrame title="This reset link has expired" sub="Links work for an hour and only once. Ask for a new one and use the latest email.">
        <Link href="/forgot" className="text-sm font-medium text-brand hover:underline">
          Send a new link
        </Link>
      </AuthFrame>
    );
  }
  return (
    <AuthFrame title="Choose a new password" sub="You'll be signed in right after, and signed out everywhere else.">
      <ResetPasswordForm action={resetPasswordAction} token={token} email={user.email} />
    </AuthFrame>
  );
}

export default function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={<AuthFrame title="Checking your link…">{null}</AuthFrame>}>
      <Body params={params} />
    </Suspense>
  );
}
