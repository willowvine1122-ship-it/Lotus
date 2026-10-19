import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { cache as reactCache } from "react";
import { after } from "next/server";
import { db } from "./db";
import { requireStaff, type Session } from "./auth";

/*
 * Each agency's data is a set of modules (clients, crm, calendars, ...),
 * each one JSON document in lotus.docs. The module stores keep their
 * synchronous API: a request opens the workspace once, every store call
 * inside reads and mutates that request's private copy, and when the work
 * is done the modules that changed are written back.
 *
 * Two people saving the same module at once do not overwrite each other:
 * the save is versioned, and on a clash the change this request made is
 * replayed onto the newer copy record by record (see merge below).
 *
 * Actions and routes open it with withWorkspace(fn), which saves before the
 * response goes out. Pages call `await openWorkspace()` at the top of each
 * data component instead: that opens it once for the whole render (every
 * component in the request shares it) and saves anything a page changed
 * after the response is sent.
 *
 * Public pages (a booking page, a form, a donation page) have no session;
 * they find their agency through a public key such as "form:<slug>",
 * which each module declares for the records it serves publicly.
 */

export interface ModuleDef<T> {
  key: string;
  init: () => T;
  /** Public addresses this module answers, e.g. "form:spring-offer". */
  publicKeys?: (state: T) => string[];
}

interface Loaded {
  version: number;
  json: string;
}

interface Open {
  version: number;
  baseJson: string;
  state: unknown;
}

export interface TeamMember {
  userId: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "member" | "client";
  accountIds: string[];
  lastLoginAt: string | null;
}

export interface WorkspaceCtx {
  agencyId: string;
  session: Session | null;
  opened: Map<string, Open>;
  docs: Map<string, Loaded>;
  members: TeamMember[];
}

const registry = new Map<string, ModuleDef<unknown>>();
const als = new AsyncLocalStorage<WorkspaceCtx>();
const g = globalThis as unknown as { __lotusDocCache?: Map<string, Map<string, Loaded>>; __lotusMembers?: Map<string, { at: number; members: TeamMember[] }> };
const cache = (g.__lotusDocCache ??= new Map());
const memberCache = (g.__lotusMembers ??= new Map());

export class NoWorkspace extends Error {
  constructor(key: string) {
    super(`Module "${key}" was read outside a workspace. Wrap the page, action or route in withWorkspace().`);
  }
}

export class PublicAddressTaken extends Error {
  constructor(public keys: string[]) {
    super(`That address is already used by another account: ${keys.map((k) => k.split(":").slice(1).join(":")).join(", ")}. Pick a different one.`);
  }
}

export function defineModule<T>(def: ModuleDef<T>) {
  registry.set(def.key, def as ModuleDef<unknown>);
  return {
    key: def.key,
    get(): T {
      const ctx = activeCtx();
      if (!ctx) throw new NoWorkspace(def.key);
      let open = ctx.opened.get(def.key);
      if (!open) {
        const loaded = ctx.docs.get(def.key);
        const state = loaded ? (JSON.parse(loaded.json) as T) : def.init();
        open = { version: loaded?.version ?? 0, baseJson: loaded?.json ?? JSON.stringify(state), state };
        ctx.opened.set(def.key, open);
      }
      return open.state as T;
    },
  };
}

/** The workspace a page render opened. React's cache is per request, so every component of one render sees the same one. */
const renderSlot = reactCache((): { ctx: WorkspaceCtx | null; opening: Promise<WorkspaceCtx | null> | null } => ({ ctx: null, opening: null }));

function activeCtx(): WorkspaceCtx | undefined {
  return als.getStore() ?? renderSlot().ctx ?? undefined;
}

export function currentWorkspace(): WorkspaceCtx | undefined {
  return activeCtx();
}

export function currentSession(): Session | null {
  return activeCtx()?.session ?? null;
}

/** Everyone with a login on this agency: staff and client logins. */
export function workspaceMembers(): TeamMember[] {
  return activeCtx()?.members ?? [];
}

async function loadMembers(agencyId: string, fresh = false): Promise<TeamMember[]> {
  const hit = memberCache.get(agencyId);
  if (!fresh && hit && Date.now() - hit.at < 15000) return hit.members;
  const rows = await db<{ user_id: string; email: string; name: string; role: TeamMember["role"]; account_ids: string[]; last_login_at: string | null }[]>("member.list", { agency: agencyId });
  const members = rows.map((r) => ({ userId: r.user_id, email: r.email, name: r.name, role: r.role, accountIds: r.account_ids ?? [], lastLoginAt: r.last_login_at }));
  memberCache.set(agencyId, { at: Date.now(), members });
  return members;
}

/** Drop the cached member list after an invite is accepted or a role changes. */
export function forgetMembers(agencyId: string) {
  memberCache.delete(agencyId);
}

async function loadDocs(agencyId: string): Promise<Map<string, Loaded>> {
  const versions = await db<Record<string, number>>("ws.versions", { agency: agencyId });
  const docs = cache.get(agencyId) ?? new Map<string, Loaded>();
  const stale = Object.entries(versions)
    .filter(([m, v]) => docs.get(m)?.version !== v)
    .map(([m]) => m);
  if (stale.length) {
    const rows = await db<{ module: string; version: number; data: unknown }[]>("ws.load", { agency: agencyId, modules: stale });
    for (const r of rows) docs.set(r.module, { version: r.version, json: JSON.stringify(r.data) });
  }
  for (const m of docs.keys()) if (!(m in versions)) docs.delete(m);
  cache.set(agencyId, docs);
  // Each request gets its own snapshot so a concurrent request's writes never show up half-way.
  return new Map(docs);
}

function isNavigation(e: unknown) {
  const digest = (e as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK") || digest === "NEXT_NOT_FOUND");
}

async function run<T>(agencyId: string, session: Session | null, fn: () => T | Promise<T>): Promise<T> {
  const outer = als.getStore();
  if (outer && outer.agencyId === agencyId) return fn();
  const [docs, members] = await Promise.all([loadDocs(agencyId), loadMembers(agencyId)]);
  const ctx: WorkspaceCtx = { agencyId, session, opened: new Map(), docs, members };
  let result: T;
  try {
    result = await als.run(ctx, fn);
  } catch (e) {
    // A redirect or notFound after a successful change still keeps the change.
    if (isNavigation(e)) await commit(ctx);
    throw e;
  }
  await commit(ctx);
  return result;
}

async function openForRender(resolve: () => Promise<{ agencyId: string; session: Session | null } | null>): Promise<WorkspaceCtx | null> {
  const slot = renderSlot();
  slot.opening ??= (async () => {
    const who = await resolve();
    if (!who) return null;
    const [docs, members] = await Promise.all([loadDocs(who.agencyId), loadMembers(who.agencyId)]);
    const ctx: WorkspaceCtx = { agencyId: who.agencyId, session: who.session, opened: new Map(), docs, members };
    slot.ctx = ctx;
    // Reads can fill in defaults (a client's first pipeline, a scheduled email that came due); keep them.
    after(() => commit(ctx));
    return ctx;
  })();
  return slot.opening;
}

/** Staff pages: open the signed-in agency's workspace for this render. Sends anyone else to sign in or to their portal. */
export async function openWorkspace(): Promise<Awaited<ReturnType<typeof requireStaff>>> {
  const session = await requireStaff();
  await openForRender(async () => ({ agencyId: session.agency.id, session }));
  return session;
}

/** Public pages: open the workspace that owns this address for this render. False when nobody does. */
export async function openPublicWorkspace(key: string): Promise<boolean> {
  const ctx = await openForRender(async () => {
    const agencyId = await db<string | null>("keys.get", { key });
    return agencyId ? { agencyId, session: null } : null;
  });
  return !!ctx;
}

/** Client portal pages and the like, for an agency the caller already checked. */
export async function openAgencyWorkspace(agencyId: string, session: Session | null) {
  await openForRender(async () => ({ agencyId, session }));
}

/** Agency staff pages, actions and routes. Sends anyone else to sign in or to their portal. */
export async function withWorkspace<T>(fn: () => T | Promise<T>): Promise<T> {
  const session = await requireStaff();
  return run(session.agency.id, session, fn);
}

/** The workspace of a known agency, for client portals and background jobs that already checked access. */
export async function withAgencyWorkspace<T>(agencyId: string, session: Session | null, fn: () => T | Promise<T>): Promise<T> {
  return run(agencyId, session, fn);
}

/** Public pages: the agency that owns the address, or null when nobody does. */
export async function withPublicWorkspace<T>(key: string, fn: () => T | Promise<T>): Promise<T | null> {
  const agencyId = await db<string | null>("keys.get", { key });
  if (!agencyId) return null;
  return run(agencyId, null, fn);
}

/** Resolve a public key to its agency without opening the workspace. */
export async function agencyForKey(key: string) {
  return db<string | null>("keys.get", { key });
}

async function commit(ctx: WorkspaceCtx) {
  const writes: Promise<void>[] = [];
  for (const [key, open] of ctx.opened) {
    const json = JSON.stringify(open.state);
    if (json === open.baseJson) continue;
    writes.push(save(ctx.agencyId, key, open, json));
  }
  await Promise.all(writes);
}

async function save(agencyId: string, key: string, open: Open, json: string) {
  const def = registry.get(key)!;
  let state = open.state;
  let version = open.version;
  let baseJson = open.baseJson;
  const keys = def.publicKeys ? [...new Set(def.publicKeys(state))] : null;
  if (keys?.length) {
    const taken = await db<string[]>("keys.taken", { agency: agencyId, keys });
    if (taken.length) throw new PublicAddressTaken(taken);
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await db<{ ok: boolean; version: number; data?: unknown }>("ws.save", { agency: agencyId, module: key, expected: version, data: state });
    if (res.ok) {
      const docs = cache.get(agencyId) ?? new Map<string, Loaded>();
      docs.set(key, { version: res.version, json: JSON.stringify(state) });
      cache.set(agencyId, docs);
      if (keys) await db("keys.sync", { agency: agencyId, module: key, keys });
      open.state = state;
      open.version = res.version;
      open.baseJson = JSON.stringify(state);
      return;
    }
    // Someone saved first: replay this request's changes onto their copy.
    state = merge(JSON.parse(baseJson), JSON.parse(json), res.data);
    json = JSON.stringify(state);
    baseJson = JSON.stringify(res.data);
    version = res.version;
  }
  throw new Error(`Could not save ${key}: too many people are saving at once. Please try again.`);
}

/* ------------------------------ merge ------------------------------- */

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const hasIds = (xs: unknown[]) => xs.every((x) => isObject(x) && typeof x.id === "string");

/**
 * Three-way merge of one module: base is what this request loaded, mine is
 * what it wants to save, theirs is what is in the database now. Records
 * are matched by id, so two people editing different contacts both win;
 * when both edit the same field, the later save wins.
 */
export function merge(base: unknown, mine: unknown, theirs: unknown): unknown {
  if (same(mine, base)) return theirs;
  if (same(theirs, base)) return mine;
  if (Array.isArray(mine) && Array.isArray(theirs)) {
    const b = Array.isArray(base) ? base : [];
    if (hasIds(mine) && hasIds(theirs) && hasIds(b)) return mergeById(b, mine, theirs);
    return mine;
  }
  if (isObject(mine) && isObject(theirs)) {
    const b = isObject(base) ? base : {};
    const out: Record<string, unknown> = {};
    for (const k of new Set([...Object.keys(theirs), ...Object.keys(mine)])) {
      const inMine = k in mine;
      const inTheirs = k in theirs;
      const inBase = k in b;
      if (inMine && inTheirs) out[k] = merge(b[k], mine[k], theirs[k]);
      else if (inMine && !inBase) out[k] = mine[k];
      else if (inTheirs && !inBase) out[k] = theirs[k];
      else if (inTheirs && inBase && !inMine) {
        // I removed it; keep their copy only if they changed it since.
        if (!same(b[k], theirs[k])) out[k] = theirs[k];
      }
      // In base and mine but gone from theirs: they removed it, so it stays removed.
    }
    return out;
  }
  return mine;
}

type Rec = Record<string, unknown> & { id: string };

function mergeById(base: unknown[], mine: unknown[], theirs: unknown[]): unknown[] {
  const b = new Map((base as Rec[]).map((x) => [x.id, x]));
  const m = new Map((mine as Rec[]).map((x) => [x.id, x]));
  const t = new Set((theirs as Rec[]).map((x) => x.id));
  const out: Rec[] = [];
  for (const x of theirs as Rec[]) {
    const mx = m.get(x.id);
    if (mx) out.push(merge(b.get(x.id), mx, x) as Rec);
    else if (!b.has(x.id)) out.push(x); // they added it
    else if (!same(b.get(x.id), x)) out.push(x); // I removed it, they edited it: keep theirs
  }
  // Records I added go where I put them: the front when I prepended, otherwise the end.
  const added = (x: Rec) => !b.has(x.id) && !t.has(x.id);
  const mineRecs = mine as Rec[];
  let i = 0;
  while (i < mineRecs.length && added(mineRecs[i]!)) i++;
  return [...mineRecs.slice(0, i), ...out, ...mineRecs.slice(i).filter(added)];
}

/** Who to credit for a change: the signed-in person, or "System" for public pages and background runs. */
export function actorName() {
  return currentSession()?.user.name ?? "System";
}
