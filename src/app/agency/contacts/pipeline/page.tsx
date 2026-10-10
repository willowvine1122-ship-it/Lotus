import { redirect } from "next/navigation";
import { Suspense } from "react";

/* The pipeline moved to Opportunities, which has every pipeline, the list and the report. */
async function Redirect({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { client } = await searchParams;
  redirect(client ? `/agency/opportunities?client=${encodeURIComponent(client)}` : "/agency/opportunities");
  return null;
}

export default function PipelinePage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  return (
    <Suspense fallback={null}>
      <Redirect searchParams={searchParams} />
    </Suspense>
  );
}
