import "server-only";

/*
 * The one door into the database. Every read and write is a call to the
 * public.lotus(key, op, args) function from migration 0019, which refuses
 * anything without the server key. In production the call goes over the
 * Supabase Data API; for local development LOTUS_DATABASE_URL points it at
 * a plain Postgres with the same migration applied.
 */

export class DatabaseNotConfigured extends Error {
  constructor() {
    super("The database is not connected. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and LOTUS_SERVER_KEY.");
  }
}

export function isDatabaseConfigured() {
  return Boolean(process.env.LOTUS_SERVER_KEY && (process.env.LOTUS_DATABASE_URL || (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)));
}

type PgPool = { query: (sql: string, params: unknown[]) => Promise<{ rows: { r: unknown }[] }> };
const g = globalThis as unknown as { __lotusPg?: Promise<PgPool> };

async function pgPool(url: string): Promise<PgPool> {
  g.__lotusPg ??= import("pg").then(({ default: pg }) => new pg.Pool({ connectionString: url, max: 5 }));
  return g.__lotusPg;
}

export async function db<T = unknown>(op: string, args: Record<string, unknown> = {}): Promise<T> {
  const key = process.env.LOTUS_SERVER_KEY;
  if (!key || !isDatabaseConfigured()) throw new DatabaseNotConfigured();

  const local = process.env.LOTUS_DATABASE_URL;
  if (local) {
    const pool = await pgPool(local);
    const { rows } = await pool.query("select public.lotus($1, $2, $3::jsonb) as r", [key, op, JSON.stringify(args)]);
    return rows[0]?.r as T;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "");
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${url}/rest/v1/rpc/lotus`, {
        method: "POST",
        headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_key: key, p_op: op, p_args: args }),
        cache: "no-store",
      });
      if (res.ok) return (await res.json()) as T;
      const text = await res.text();
      // 4xx is a real answer (bad input, forbidden); only retry on server or network trouble.
      if (res.status < 500) throw new DatabaseError(op, res.status, text);
      last = new DatabaseError(op, res.status, text);
    } catch (e) {
      if (e instanceof DatabaseError && e.status < 500) throw e;
      last = e;
    }
    await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
  }
  throw last;
}

export class DatabaseError extends Error {
  constructor(
    public op: string,
    public status: number,
    body: string,
  ) {
    super(`Database call ${op} failed (${status}): ${body.slice(0, 300)}`);
  }
}
