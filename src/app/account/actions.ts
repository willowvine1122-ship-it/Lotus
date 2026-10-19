"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canManageTeam, currentTokenHash, endSession, getSession, hashPassword, homeFor, normalEmail, requireSession, requireStaff, sha256, startSession, verifyPassword, type Role } from "@/lib/server/auth";
import { db, isDatabaseConfigured } from "@/lib/server/db";
import { issueInvite } from "@/lib/server/invites";
import { forgetMembers } from "@/lib/server/workspace";

/*
 * Accounts: sign up, sign in, the agency's team and invites, and each
 * person's own profile. Everything that decides who may do what is checked
 * here on the server; the forms only collect input.
 */

export type AccountState = { ok: boolean; message?: string; errors?: Record<string, string>; link?: string; values?: Record<string, string> } | null;

/** What was typed, handed back so a form that failed keeps it (React resets forms after an action). */
function typed(formData: FormData, ...keys: string[]) {
  return Object.fromEntries(keys.map((k) => [k, String(formData.get(k) ?? "")]));
}

const MAX_ATTEMPTS = 8;

const password = z.string().min(10, "Use at least 10 characters").max(200);
const email = z.email("Enter a valid email").max(200);
const name = z.string().trim().min(2, "Enter a name").max(80);

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of error.issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

function notReady(): AccountState {
  return { ok: false, message: "Lotus isn't connected to its database yet, so accounts can't be created. The owner needs to finish setup." };
}

/** A path inside Lotus to return to after signing in, never another site. */
function safeNext(v: FormDataEntryValue | null) {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : null;
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
}

/* ------------------------------ sign up / in ------------------------------ */

const signUpSchema = z.object({ name, agency: z.string().trim().min(2, "Name your agency").max(80), email, password, timeZone: z.string().max(60).optional() });

export async function signUpAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  if (!isDatabaseConfigured()) return notReady();
  const values = typed(formData, "name", "agency", "email");
  const p = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return { ok: false, errors: fieldErrors(p.error), values };
  const d = p.data;
  const user = await db<UserRow | null>("user.create", { email: normalEmail(d.email), name: d.name, password_hash: await hashPassword(d.password) });
  if (!user) return { ok: false, errors: { email: "There's already an account with this email. Sign in instead." }, values };
  const agency = await db<{ id: string }>("agency.create", { name: d.agency, owner_id: user.id, settings: { timeZone: d.timeZone || "America/New_York" } });
  await startSession(user.id, agency.id);
  redirect("/agency");
}

export async function signInAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  if (!isDatabaseConfigured()) return notReady();
  const addr = normalEmail(String(formData.get("email") ?? ""));
  const pw = String(formData.get("password") ?? "");
  const values = typed(formData, "email");
  if (!addr) return { ok: false, errors: { email: "Enter your email." }, values };
  if (!pw) return { ok: false, errors: { password: "Enter your password." }, values };
  const attempts = await db<number>("attempts.count", { email: addr, minutes: 15 });
  if (attempts >= MAX_ATTEMPTS) return { ok: false, message: "Too many tries. Wait 15 minutes, then try again.", values };
  const user = await db<UserRow | null>("user.by_email", { email: addr });
  if (!user || !(await verifyPassword(pw, user.password_hash))) {
    await db("attempts.add", { email: addr });
    return { ok: false, message: "That email and password don't match.", values };
  }
  await db("attempts.clear", { email: addr });
  const home = await startSession(user.id);
  redirect(safeNext(formData.get("next")) ?? home);
}

export async function signOutAction() {
  await endSession();
  redirect("/login");
}

/** Someone signed in with no agency yet (their invite was withdrawn, or they signed up from an invite they then left) starts their own. */
export async function createAgencyAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const s = await getSession();
  if (!s) redirect("/login");
  const p = z.object({ agency: z.string().trim().min(2, "Name your agency").max(80), timeZone: z.string().max(60).optional() }).safeParse(Object.fromEntries(formData));
  if (!p.success) return { ok: false, errors: fieldErrors(p.error) };
  const agency = await db<{ id: string }>("agency.create", { name: p.data.agency, owner_id: s.user.id, settings: { timeZone: p.data.timeZone || "America/New_York" } });
  const hash = await currentTokenHash();
  await db("session.switch", { token_hash: hash, agency_id: agency.id });
  redirect("/agency");
}

export async function switchAgencyAction(agencyId: string) {
  const s = await getSession();
  if (!s) redirect("/login");
  const target = s.agencies.find((a) => a.id === agencyId);
  if (!target) return;
  await db("session.switch", { token_hash: await currentTokenHash(), agency_id: agencyId });
  redirect(homeFor(target.role));
}

/* --------------------------------- agency -------------------------------- */

const agencySchema = z.object({
  name: z.string().trim().min(2, "Name your agency").max(80),
  timeZone: z.string().trim().min(1).max(60),
  website: z.union([z.literal(""), z.url("Enter a full address, like https://youragency.com").max(200)]),
  phone: z.string().trim().max(40),
  brandColor: z.union([z.literal(""), z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #6d3df2")]),
});

export async function updateAgencyAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const s = await requireStaff();
  if (!canManageTeam(s.role)) return { ok: false, message: "Only the owner or an admin can change agency details." };
  const p = agencySchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return { ok: false, errors: fieldErrors(p.error) };
  const { name: agencyName, ...settings } = p.data;
  await db("agency.update", { id: s.agency.id, name: agencyName, settings: { ...settings, website: settings.website || undefined, brandColor: settings.brandColor || undefined } });
  revalidatePath("/agency", "layout");
  return { ok: true, message: "Agency details saved" };
}

export async function dismissSetupAction() {
  const s = await requireStaff();
  await db("agency.update", { id: s.agency.id, settings: { setupDismissed: true } });
  revalidatePath("/agency");
}

/* ---------------------------------- team ---------------------------------- */

const inviteSchema = z.object({
  email,
  name: z.string().trim().max(80).optional(),
  role: z.enum(["admin", "member", "client"]),
  accountIds: z.array(z.string().min(1).max(80)).max(200),
});

export async function inviteAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const s = await requireStaff();
  if (!canManageTeam(s.role)) return { ok: false, message: "Only the owner or an admin can invite people." };
  const values = typed(formData, "email", "name");
  const p = inviteSchema.safeParse({ email: formData.get("email"), name: formData.get("name") || undefined, role: formData.get("role"), accountIds: formData.getAll("accountIds").map(String) });
  if (!p.success) return { ok: false, errors: fieldErrors(p.error), values };
  const d = p.data;
  if (d.role === "client" && d.accountIds.length === 0) return { ok: false, errors: { accountIds: "Pick the client account this login can see." }, values };
  const addr = normalEmail(d.email);
  const members = await db<{ email: string }[]>("member.list", { agency: s.agency.id });
  if (members.some((m) => normalEmail(m.email) === addr)) return { ok: false, errors: { email: "This person is already on the team." }, values };

  const sent = await issueInvite(s, { email: addr, name: d.name, role: d.role, accountIds: d.accountIds });
  revalidatePath("/agency/settings");
  return { ok: true, ...sent };
}

export async function revokeInviteAction(id: string) {
  const s = await requireStaff();
  if (!canManageTeam(s.role)) return;
  await db("invite.revoke", { agency: s.agency.id, id });
  revalidatePath("/agency/settings");
}

export async function setMemberAction(userId: string, role: Exclude<Role, "owner">, accountIds: string[]): Promise<AccountState> {
  const s = await requireStaff();
  if (!canManageTeam(s.role)) return { ok: false, message: "Only the owner or an admin can change roles." };
  const p = z.object({ role: z.enum(["admin", "member", "client"]), accountIds: z.array(z.string().max(80)).max(200) }).safeParse({ role, accountIds });
  if (!p.success) return { ok: false, message: "That role isn't valid." };
  const members = await db<{ user_id: string; role: Role }[]>("member.list", { agency: s.agency.id });
  const target = members.find((m) => m.user_id === userId);
  if (!target) return { ok: false, message: "That person isn't on the team any more." };
  if (target.role === "owner") return { ok: false, message: "The owner's role can't be changed." };
  if (p.data.role === "client" && p.data.accountIds.length === 0) return { ok: false, message: "Pick the client account this login can see." };
  await db("member.set", { agency: s.agency.id, user_id: userId, role: p.data.role, account_ids: p.data.role === "client" ? p.data.accountIds : [] });
  forgetMembers(s.agency.id);
  revalidatePath("/agency/settings");
  return { ok: true, message: "Saved" };
}

export async function removeMemberAction(userId: string): Promise<AccountState> {
  const s = await requireStaff();
  if (!canManageTeam(s.role)) return { ok: false, message: "Only the owner or an admin can remove people." };
  if (userId === s.user.id) return { ok: false, message: "You can't remove yourself." };
  await db("member.remove", { agency: s.agency.id, user_id: userId });
  forgetMembers(s.agency.id);
  revalidatePath("/agency/settings");
  return { ok: true, message: "Removed" };
}

/* --------------------------------- invites -------------------------------- */

interface InviteRow {
  invite: { id: string; agency_id: string; email: string; name: string; role: Role; account_ids: string[] };
  agency_name: string;
}

export async function acceptInviteAction(token: string, _prev: AccountState, formData: FormData): Promise<AccountState> {
  if (!isDatabaseConfigured()) return notReady();
  const row = await db<InviteRow | null>("invite.get", { token_hash: sha256(token) });
  if (!row) return { ok: false, message: "This invite has expired or was already used. Ask for a new one." };
  const inv = row.invite;
  const s = await getSession();

  let userId: string;
  if (s && normalEmail(s.user.email) === normalEmail(inv.email)) {
    userId = s.user.id;
  } else {
    const existing = await db<UserRow | null>("user.by_email", { email: inv.email });
    const pw = String(formData.get("password") ?? "");
    if (existing) {
      if (!(await verifyPassword(pw, existing.password_hash))) return { ok: false, errors: { password: "That password doesn't match your Lotus account." } };
      userId = existing.id;
    } else {
      const p = z.object({ name, password }).safeParse({ name: formData.get("name"), password: pw });
      if (!p.success) return { ok: false, errors: fieldErrors(p.error), values: typed(formData, "name") };
      const created = await db<UserRow | null>("user.create", { email: normalEmail(inv.email), name: p.data.name, password_hash: await hashPassword(p.data.password) });
      if (!created) return { ok: false, message: "Couldn't create your account. Try again." };
      userId = created.id;
    }
  }
  const accepted = await db("invite.accept", { id: inv.id, user_id: userId });
  if (!accepted) return { ok: false, message: "This invite was already used." };
  forgetMembers(inv.agency_id);
  if (s && s.user.id === userId) {
    await db("session.switch", { token_hash: await currentTokenHash(), agency_id: inv.agency_id });
  } else {
    if (s) await endSession();
    await startSession(userId, inv.agency_id);
  }
  redirect(homeFor(inv.role));
}

/* --------------------------------- profile -------------------------------- */

export async function updateProfileAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const s = await requireSession();
  const p = z.object({ name, email }).safeParse(Object.fromEntries(formData));
  if (!p.success) return { ok: false, errors: fieldErrors(p.error) };
  const addr = normalEmail(p.data.email);
  if (addr !== normalEmail(s.user.email)) {
    const taken = await db<UserRow | null>("user.by_email", { email: addr });
    if (taken) return { ok: false, errors: { email: "Another account already uses this email." } };
  }
  await db("user.update", { id: s.user.id, name: p.data.name, email: addr });
  forgetMembers(s.agency.id);
  revalidatePath("/", "layout");
  return { ok: true, message: "Profile saved" };
}

export async function changePasswordAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const s = await requireSession();
  const p = z.object({ current: z.string().min(1, "Enter your current password"), next: password }).safeParse(Object.fromEntries(formData));
  if (!p.success) return { ok: false, errors: fieldErrors(p.error) };
  const user = await db<UserRow | null>("user.by_email", { email: s.user.email });
  if (!user || !(await verifyPassword(p.data.current, user.password_hash))) return { ok: false, errors: { current: "That isn't your current password." } };
  await db("user.update", { id: s.user.id, password_hash: await hashPassword(p.data.next) });
  // Every other device signs in again with the new password.
  await db("session.delete_others", { user_id: s.user.id, keep: await currentTokenHash() });
  return { ok: true, message: "Password changed. You've been signed out everywhere else." };
}
