import Link from "next/link";
import { requestResetAction } from "@/app/account/actions";
import { AuthFrame } from "@/components/account/auth-frame";
import { ForgotPasswordForm } from "@/components/account/auth-forms";

export const metadata = { title: "Reset your password" };

export default function ForgotPage() {
  return (
    <AuthFrame
      title="Reset your password"
      sub="Enter the email you sign in with and we'll send you a link to choose a new password."
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-brand hover:underline">
            Back to sign in
          </Link>
        </>
      }
    >
      <ForgotPasswordForm action={requestResetAction} />
    </AuthFrame>
  );
}
