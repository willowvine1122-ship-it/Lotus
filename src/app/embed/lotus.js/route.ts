import { listElements } from "@/lib/data/elements";
import { isOverlay } from "@/lib/elements";

/*
 * The install script. A site adds it once:
 *   <script src="https://<lotus>/embed/lotus.js?account=<id>" async></script>
 * then places inline elements with a placeholder anchor
 *   <a href="#lotus-<element id>" style="display:none"></a>
 * and can turn any link into a donate link with href="#lotus-donate-<element id>".
 * Overlays (bars, popups, sticky buttons, social proof) need no code: the
 * account's live overlays are listed in the script and run by their rules.
 *
 * Each element is an iframe of /e/<id>, sized by the messages it sends; the
 * checkout opens in a full-window iframe so it sits over the whole site.
 */

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = `${req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "")}://${req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host}`;
  const account = url.searchParams.get("account") ?? "";
  const overlays = account
    ? listElements(new Date())
        .filter((e) => e.accountId === account && e.status === "live" && isOverlay(e.type))
        .map((e) => e.id)
    : [];
  const body = script(origin, overlays);
  return new Response(body, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=60",
      "access-control-allow-origin": "*",
    },
  });
}

function script(origin: string, overlays: string[]) {
  return `/* Lotus donation elements */
(function () {
  if (window.__lotusElements) return;
  window.__lotusElements = true;
  var ORIGIN = ${JSON.stringify(origin)};
  var OVERLAYS = ${JSON.stringify(overlays)};
  var Z = 2147483000;
  var frames = {};
  var checkout = null;

  function css(el, s) { for (var k in s) el.style[k] = s[k]; }
  function frame(src, title) {
    var f = document.createElement("iframe");
    f.src = src;
    f.title = title || "Donate";
    f.setAttribute("allowtransparency", "true");
    f.setAttribute("loading", "lazy");
    css(f, { border: "0", width: "100%", height: "0", display: "block", background: "transparent", colorScheme: "normal" });
    return f;
  }

  function scan() {
    var as = document.querySelectorAll('a[href^="#lotus-"]:not([data-lotus])');
    for (var i = 0; i < as.length; i++) {
      var a = as[i];
      var id = a.getAttribute("href").slice(7);
      a.setAttribute("data-lotus", "1");
      if (id.indexOf("donate-") === 0) continue;
      if (frames[id] && frames[id].inline) continue;
      var f = frame(ORIGIN + "/e/" + encodeURIComponent(id), "Donate");
      a.parentNode.insertBefore(f, a);
      frames[id] = { f: f, inline: true };
    }
  }

  function addOverlay(id) {
    if (frames[id]) return;
    try { if (sessionStorage.getItem("lotus-hide-" + id)) return; } catch (e) {}
    var f = frame(ORIGIN + "/e/" + encodeURIComponent(id), "Donate");
    f.removeAttribute("loading");
    css(f, { position: "fixed", width: "0", height: "0", visibility: "hidden", zIndex: String(Z) });
    document.body.appendChild(f);
    frames[id] = { f: f, inline: false };
  }

  function wild(p, s) {
    var parts = p.toLowerCase().split("*");
    s = s.toLowerCase();
    if (parts.length === 1) return parts[0] === s;
    if (s.indexOf(parts[0]) !== 0) return false;
    var pos = parts[0].length;
    for (var i = 1; i < parts.length - 1; i++) {
      var j = s.indexOf(parts[i], pos);
      if (j < 0) return false;
      pos = j + parts[i].length;
    }
    var last = parts[parts.length - 1];
    return s.length - pos >= last.length && s.slice(s.length - last.length) === last;
  }
  function matches(path, list) {
    for (var i = 0; i < list.length; i++) {
      var p = (list[i] || "").trim();
      if (p && wild(p, path)) return true;
    }
    return false;
  }

  function allowed(rules) {
    var mobile = window.innerWidth < 768;
    if (rules.devices === "mobile" && !mobile) return false;
    if (rules.devices === "desktop" && mobile) return false;
    var today = new Date().toISOString().slice(0, 10);
    if (rules.startsOn && today < rules.startsOn) return false;
    if (rules.endsOn && today > rules.endsOn) return false;
    var path = location.pathname + location.search;
    var url = location.href;
    if (matches(path, rules.hideOn || []) || matches(url, rules.hideOn || [])) return false;
    var show = (rules.showOn || []).filter(function (p) { return p && p.trim(); });
    return !show.length || matches(path, show) || matches(url, show);
  }

  function arm(id, rules) {
    if (frames[id].armed) return;
    frames[id].armed = true;
    var fired = false;
    function show() {
      if (fired) return;
      fired = true;
      var x = frames[id];
      if (!x) return;
      x.shown = true;
      if (x.type === "popup") css(x.f, { inset: "0", width: "100%", height: "100%" });
      // Room to lay out in before the element reports its real size.
      else if (x.type === "message_bar") css(x.f, { left: "0", right: "0", width: "100%", height: "56px" });
      else css(x.f, { width: Math.min(400, window.innerWidth) + "px", height: "160px" });
      x.f.style.visibility = "visible";
      x.f.contentWindow.postMessage({ lotus: true, kind: "show", id: id }, ORIGIN);
    }
    if (rules.trigger === "delay") return setTimeout(show, Math.max(0, rules.delay) * 1000);
    if (rules.trigger === "scroll") {
      var on = function () {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        if (max <= 0 || window.scrollY / max >= rules.scroll / 100) { show(); window.removeEventListener("scroll", on); }
      };
      window.addEventListener("scroll", on, { passive: true });
      return on();
    }
    if (rules.trigger === "exit") {
      document.addEventListener("mouseout", function (e) { if (e.clientY <= 0 && !e.relatedTarget) show(); });
      if (window.innerWidth < 768) setTimeout(show, 12000);
      return;
    }
    show();
  }

  function place(x, w, h) {
    var p = x.position;
    if (x.type === "popup") return;
    if (x.type === "message_bar") {
      css(x.f, { left: "0", right: "0", width: "100%", height: h + "px" });
      if (p === "bottom") css(x.f, { bottom: "0", top: "" }); else css(x.f, { top: "0", bottom: "" });
      return;
    }
    // The element pads itself so its shadow fits; the frame sits 4px in from the edge.
    css(x.f, { width: w + 2 + "px", height: h + 2 + "px" });
    if (p === "bottom_left") css(x.f, { left: "4px", bottom: "4px" });
    else if (p === "right_edge") css(x.f, { right: "0", top: "50%", transform: "translateY(-50%)" });
    else if (p === "top") css(x.f, { right: "4px", top: "4px" });
    else css(x.f, { right: "4px", bottom: "4px" });
  }

  function openCheckout(d) {
    if (checkout) return;
    var q = "?element=" + encodeURIComponent(d.id || "") + "&amount=" + (d.amount || "") + "&frequency=" + (d.frequency || "") + "&accent=" + encodeURIComponent(d.accent || "");
    checkout = frame(ORIGIN + "/e/checkout/" + encodeURIComponent(d.campaign || "el") + q, "Donate");
    checkout.removeAttribute("loading");
    css(checkout, { position: "fixed", inset: "0", width: "100%", height: "100%", zIndex: String(Z + 10) });
    checkout.dataset.overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.appendChild(checkout);
  }
  function closeCheckout() {
    if (!checkout) return;
    document.documentElement.style.overflow = checkout.dataset.overflow || "";
    checkout.parentNode.removeChild(checkout);
    checkout = null;
  }

  window.addEventListener("message", function (e) {
    if (e.origin !== ORIGIN) return;
    var d = e.data;
    if (!d || !d.lotus) return;
    if (d.kind === "close-checkout") return closeCheckout();
    var x = frames[d.id];
    if (d.kind === "donate") return openCheckout(d);
    if (!x) return;
    if (d.kind === "ready") {
      x.type = d.type;
      x.position = d.position;
      if (d.overlay && !x.inline) {
        if (d.rules && allowed(d.rules)) arm(d.id, d.rules);
      }
    } else if (d.kind === "size") {
      if (x.inline) x.f.style.height = d.h + "px";
      else if (x.shown) place(x, d.w, d.h);
    } else if (d.kind === "hide") {
      if (x.f.parentNode) x.f.parentNode.removeChild(x.f);
      try { sessionStorage.setItem("lotus-hide-" + d.id, "1"); } catch (err) {}
    }
  });

  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href^="#lotus-donate-"]') : null;
    if (!a) return;
    e.preventDefault();
    openCheckout({ id: a.getAttribute("href").slice(14), campaign: "el" });
  });

  function start() {
    scan();
    for (var i = 0; i < OVERLAYS.length; i++) addOverlay(OVERLAYS[i]);
    if (window.MutationObserver) new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
`;
}
