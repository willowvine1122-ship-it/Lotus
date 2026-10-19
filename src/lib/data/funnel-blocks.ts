import { stamp } from "@/lib/ids";
import type { FunnelBlock, FunnelStep } from "@/lib/types";
import { blocksToDoc } from "@/components/builder/model";

let counter = 0;
const bid = () => `b${(++counter).toString(36)}`;

/** Steps saved before the visual builder get a builder page made from their blocks. */
export function withDocs(steps: FunnelStep[]): FunnelStep[] {
  return steps.map((s, i) => ({ ...s, kind: s.kind ?? (i === 0 ? "optin" : i === steps.length - 1 ? "thankyou" : "custom"), doc: s.doc ?? blocksToDoc(s.blocks) }));
}

export function newBlock(type: FunnelBlock["type"]): FunnelBlock {
  const id = bid() + stamp();
  switch (type) {
    case "hero": return { id, type, headline: "Headline", subhead: "Supporting sentence.", buttonLabel: "Get started", buttonHref: "#form", align: "center" };
    case "form": return { id, type, headline: "Get in touch", fields: ["name", "email", "phone"], buttonLabel: "Send" };
    case "features": return { id, type, headline: "Why us", items: [{ title: "First point", body: "One sentence." }, { title: "Second point", body: "One sentence." }, { title: "Third point", body: "One sentence." }] };
    case "stats": return { id, type, items: [{ value: "4.9", label: "rating" }, { value: "1,000+", label: "jobs" }, { value: "24h", label: "turnaround" }] };
    case "testimonial": return { id, type, quote: "What a customer said.", name: "Name", detail: "Where" };
    case "text": return { id, type, headline: "Section title", body: "A paragraph of text." };
    case "faq": return { id, type, items: [{ q: "A question?", a: "The answer." }] };
    case "cta": return { id, type, headline: "Ready?", body: "One line to push them over.", buttonLabel: "Get started", buttonHref: "#form" };
    case "footer": return { id, type, text: "© Company" };
  }
}
