import type { Contact } from "@/lib/types";
import { cn } from "@/lib/utils";
import { contactInitials, contactName } from "./format";

/** Contacts are people outside the agency, so their mark stays neutral; colour is for the team. */
export function ContactAvatar({ contact, size = "md" }: { contact: Pick<Contact, "firstName" | "lastName">; size?: "md" | "lg" }) {
  return (
    <span
      aria-hidden
      title={contactName(contact)}
      className={cn(
        "grid shrink-0 place-items-center rounded-full border border-line bg-surface-2 font-semibold text-fg-2",
        size === "md" ? "size-8 text-2xs" : "size-10 text-xs",
      )}
    >
      {contactInitials(contact)}
    </span>
  );
}
