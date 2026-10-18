import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createAgencyAction, signOutAction } from "@/app/account/actions";
import { AuthFrame } from "@/components/account/auth-frame";
import { CreateAgencyForm } from "@/components/account/auth-forms";
import { getSession, homeFor } from "@/lib/server/auth";

export const metadata = { title: "Welcome" };

/* Signed in but not in any agency: their access was removed, or they never had one. */
async function Body() {
  await connection();
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.agency && s.role) redirect(homeFor(s.role));
  return (
    <>
      <p className="mb-5 text-sm text-fg-2">
        You&apos;re signed in as <span className="font-medium text-fg">{s.user.email}</span> but you aren&apos;t part of an agency right now. If you were expecting an invite, ask for a new link. Or start your own agency.
      </p>
      <CreateAgencyForm action={createAgencyAction} />
      <form action={signOutAction} className="mt-4">
        <button type="submit" className="text-sm text-fg-3 underline hover:text-fg">
          Sign out
        </button>
      </form>
    </>
  );
}

export default function WelcomePage() {
  return (
    <AuthFrame title="Welcome to Lotus">
      <Suspense fallback={<div className="h-[200px]" />}>
        <Body />
      </Suspense>
    </AuthFrame>
  );
}
