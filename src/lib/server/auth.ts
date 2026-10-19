import "server-only";
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";

/*
 * Lotus sign-in. Passwords are hashed with scrypt; a session is a random
 * token in an HttpOnly cookie whose SHA-256 is stored in lotus.sessions,
 * so a leaked database never yields a usable cookie. Every request reads
 * the session once (React cache) and gets the user, the agency they are
 * working in and their role there.
 */

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;
const COOKIE = "lotus_session";
const SESSION_DAYS = 30;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export type Role = "owner" | "admin" | "member" | "client";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

export interface Session {
  user: SessionUser;
  agency: { id: string; name: string; settings: AgencySettings } | null;
  role: Role | null;
  /** Sub-accounts a client login may see. Empty for agency staff, who see all. */
  accountIds: string[];
  agencies: { id: string; name: string; role: Role }[];
}

export interface AgencySettings {
  logoUrl?: string;
  brandColor?: string;
  timeZone?: string;
  website?: string;
  phone?: string;
  /** Setup checklist items the owner dismissed or finished. */
  setupDismissed?: boolean;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64, SCRYPT);
  return `scrypt$${SCRYPT.N}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, n, saltB64, keyB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const key = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length, { ...SCRYPT, N: Number(n) });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function newToken() {
  return randomBytes(32).toString("base64url");
}

interface RawSession {
  user: { id: string; email: string; name: string };
  agency: { id: string; name: string; settings: AgencySettings } | null;
  membership: { role: Role; account_ids: string[] } | null;
  agencies: { id: string; name: string; role: Role }[];
}

/** The signed-in person for this request, or null. Read once per request. */
export const getSession = cache(async (): Promise<Session | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const raw = await db<RawSession | null>("session.get", { token_hash: sha256(token) });
  if (!raw?.user) return null;
  return {
    user: { id: raw.user.id, email: raw.user.email, name: raw.user.name },
    agency: raw.agency && raw.membership ? { id: raw.agency.id, name: raw.agency.name, settings: raw.agency.settings ?? {} } : null,
    role: raw.membership?.role ?? null,
    accountIds: raw.membership?.account_ids ?? [],
    agencies: raw.agencies ?? [],
  };
});

/** For agency pages: signed in, working in an agency, as staff. Clients go to their portal. */
export async function requireStaff(): Promise<Session & { agency: NonNullable<Session["agency"]>; role: Exclude<Role, "client"> }> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!s.agency || !s.role) redirect("/welcome");
  if (s.role === "client") redirect("/portal");
  return s as Session & { agency: NonNullable<Session["agency"]>; role: Exclude<Role, "client"> };
}

export async function requireSession(): Promise<Session & { agency: NonNullable<Session["agency"]>; role: Role }> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!s.agency || !s.role) redirect("/welcome");
  return s as Session & { agency: NonNullable<Session["agency"]>; role: Role };
}

export function canManageTeam(role: Role | null) {
  return role === "owner" || role === "admin";
}

/**
 * Sign someone in. With no agency given, they land in the first agency
 * they belong to (staff seats before client logins), or none yet.
 * Returns where they should go next.
 */
export async function startSession(userId: string, agencyId?: string | null): Promise<string> {
  const token = newToken();
  const hash = sha256(token);
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000);
  await db("session.create", { token_hash: hash, user_id: userId, agency_id: agencyId ?? "", expires_at: expires.toISOString() });
  await db("user.update", { id: userId, login: true });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
  let raw = await db<RawSession | null>("session.get", { token_hash: hash });
  if (raw && !raw.agency && raw.agencies.length) {
    const pick = raw.agencies.find((x) => x.role !== "client") ?? raw.agencies[0]!;
    await db("session.switch", { token_hash: hash, agency_id: pick.id });
    raw = await db<RawSession | null>("session.get", { token_hash: hash });
  }
  return homeFor(raw?.membership?.role ?? null);
}

/** Where a role starts: staff on the Daily Diagnostic, client logins in their portal, people with no agency yet on the welcome page. */
export function homeFor(role: Role | null) {
  return !role ? "/welcome" : role === "client" ? "/portal" : "/agency";
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db("session.delete", { token_hash: sha256(token) });
  jar.delete(COOKIE);
}

export async function currentTokenHash() {
  const token = (await cookies()).get(COOKIE)?.value;
  return token ? sha256(token) : null;
}

export function normalEmail(email: string) {
  return email.trim().toLowerCase();
}
