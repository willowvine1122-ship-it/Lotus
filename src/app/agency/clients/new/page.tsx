import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Shell } from "@/components/shell";

export const metadata = { title: "Add client" };

/* Placeholder until onboarding is built; the route exists so the primary
 * action on the board goes somewhere honest. */
export default function NewClientPage() {
  return (
    <Shell current="/agency/clients">
      <PageHeader
        title="Add client"
        meta={
          <Link href="/agency/clients" className="inline-flex items-center gap-1 text-rail-fg hover:underline">
            <ArrowLeft className="size-3.5" strokeWidth={2} />
            Clients
          </Link>
        }
      />
      <div className="px-5 py-6 md:px-8">
        <p className="max-w-[60ch] text-sm leading-relaxed text-fg-2">
          Client onboarding is next on the build list. A new client gets its own sub-account, a mode
          (digital marketing or digital fundraising), its own branding, and a Daily Diagnostic from the
          first morning after its data feeds connect.
        </p>
      </div>
    </Shell>
  );
}
