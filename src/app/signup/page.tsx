import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { signUpAction } from "@/app/account/actions";
import { AuthFrame } from "@/components/account/auth-frame";
import { SignUpForm } from "@/components/account/auth-forms";
import { getSession, homeFor } from "@/lib/server/auth";
import { isDatabaseConfigured } from "@/lib/server/db";

export const metadata = { title: "Create your agency" };

async function Form() {
  await connection();
  const session = isDatabaseConfigured() ? await getSession() : null;
  if (session) redirect(homeFor(session.role));
  return <SignUpForm action={signUpAction} />;
}

export default function SignUpPage() {
  return (
    <AuthFrame
      title="Create your agency"
      sub="You'll be the owner. Add clients and invite your team once you're in."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-brand hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <Suspense fallback={<div className="h-[340px]" />}>
        <Form />
      </Suspense>
    </AuthFrame>
  );
}
