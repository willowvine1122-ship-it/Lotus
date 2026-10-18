import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { signInAction } from "@/app/account/actions";
import { AuthFrame } from "@/components/account/auth-frame";
import { SignInForm } from "@/components/account/auth-forms";
import { getSession, homeFor } from "@/lib/server/auth";
import { isDatabaseConfigured } from "@/lib/server/db";

export const metadata = { title: "Sign in" };

async function Form({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  await connection();
  const [{ next }, session] = await Promise.all([searchParams, isDatabaseConfigured() ? getSession() : null]);
  if (session) redirect(homeFor(session.role));
  return <SignInForm action={signInAction} next={next?.startsWith("/") && !next.startsWith("//") ? next : undefined} />;
}

export default function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return (
    <AuthFrame
      title="Sign in"
      sub="Agency team and client logins use the same door."
      footer={
        <>
          New to Lotus?{" "}
          <Link href="/signup" className="font-medium text-brand hover:underline">
            Create an agency account
          </Link>
        </>
      }
    >
      <Suspense fallback={<div className="h-[212px]" />}>
        <Form searchParams={searchParams} />
      </Suspense>
    </AuthFrame>
  );
}
