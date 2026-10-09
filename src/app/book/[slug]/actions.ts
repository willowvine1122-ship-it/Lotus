"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { bookAppointment } from "@/lib/data/calendars";

/*
 * The one action a lead can take on the public page. The slot is re-checked
 * on the server; a taken slot comes back as an error the page shows above
 * the form, with the times refreshed.
 */

export type BookingState = { ok: boolean; errors?: Record<string, string>; message?: string } | null;

const schema = z.object({
  typeId: z.string().min(1),
  startsAt: z.string().datetime({ message: "Pick a time first" }),
  name: z.string().trim().min(2, "Your full name"),
  email: z.string().trim().email("Enter an email we can send the confirmation to"),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || v.replace(/\D/g, "").length >= 7, "Enter a phone number with area code, or leave it empty"),
  notes: z.string().trim().max(1000, "Keep it under 1,000 characters").optional(),
});

export async function bookAction(slug: string, _prev: BookingState, formData: FormData): Promise<BookingState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) errors[String(i.path[0])] ??= i.message;
    return { ok: false, errors };
  }
  const res = bookAppointment(new Date(), { calendarSlug: slug, ...parsed.data });
  if (!res.ok) {
    revalidatePath(`/book/${slug}`);
    return {
      ok: false,
      message: res.reason === "slot_taken" ? "Someone just took that time. Pick another one; the list is up to date." : "This booking page is not taking bookings right now.",
    };
  }
  revalidatePath("/agency/calendars");
  redirect(`/book/${slug}/confirmed/${res.appointment.id}`);
}
