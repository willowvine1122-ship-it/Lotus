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
  // Agency pages need a sign-in; send people without a session cookie straight to the door.
  // (The pages check the session itself; this only saves a round trip through a loading screen.)
  const path = request.nextUrl.pathname;
  if ((path === "/agency" || path.startsWith("/agency/")) && !request.cookies.has("lotus_session") && isAppHost(request)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  if (appHosts.length === 0) return NextResponse.next();
  const host = (request.headers.get("host") ?? "").toLowerCase().replace(/:\d+$/, "");
  if (!host || appHosts.includes(host) || host === "localhost") return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = `/d/${encodeURIComponent(host)}${url.pathname === "/" ? "" : url.pathname}`;
  return NextResponse.rewrite(url);
}

function isAppHost(request: NextRequest) {
  if (appHosts.length === 0) return true;
  const host = (request.headers.get("host") ?? "").toLowerCase().replace(/:\d+$/, "");
  return !host || appHosts.includes(host) || host === "localhost";
}

export const config = {
  // Next's own assets, the form embeds and the donation elements a site page loads stay on their real paths.
  matcher: ["/((?!_next/|api/|form/|e/|embed/|elements/|favicon.ico).*)"],
};
