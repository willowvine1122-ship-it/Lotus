"use client";

import { useRouter } from "next/navigation";
import type { ClientRef } from "@/components/crm/model";

export function ClientSwitch({
  clients,
  value,
}: {
  clients: ClientRef[];
  value: string;
}) {
  const router = useRouter();
  return (
    <select
      aria-label="Client"
      value={value}
      onChange={(e) =>
        router.push(
          `/agency/opportunities/pipelines?client=${clients.find((c) => c.id === e.target.value)?.slug ?? ""}`,
        )
      }
      className="h-7 max-w-[200px] rounded border border-rail-line bg-rail-2 px-2 text-xs font-medium text-rail-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      {clients.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
