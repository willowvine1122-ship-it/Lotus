import { NextResponse, type NextRequest } from "next/server";

/*
 * Custom domains for client websites. When LOTUS_APP_HOSTS is set (a comma
 * list of the hosts the app itself answers on, e.g. "app.lotus.app"), any
 * other host is treated as a client's domain and its paths are served from
 * /d/<host>/<path>. Unset, as in development, nothing is rewritten.
 */

const appHosts = (process.env.LOTUS_APP_HOSTS ?? "")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

export function proxy(request: NextRequest) {
  if (appHosts.length === 0) return NextResponse.next();
  const host = (request.headers.get("host") ?? "").toLowerCase().replace(/:\d+$/, "");
  if (!host || appHosts.includes(host) || host === "localhost") return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = `/d/${encodeURIComponent(host)}${url.pathname === "/" ? "" : url.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Next's own assets and the form embeds a site page loads stay on their real paths.
  matcher: ["/((?!_next/|api/|form/|favicon.ico).*)"],
};
