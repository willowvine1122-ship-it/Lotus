// Renders the settled "Rise" frame (the mark on the water, no copy) to public/hero/rise-still*.webp.
// Those stills are the hero for reduced-motion, no-WebGL and low-power visitors.
//
//   npm run build && npm run hero:still      (then build again so the export picks the files up)
//
// Needs a Chromium: Google Chrome installed (channel "chrome"), or PW_CHROMIUM=/path/to/chromium.
// WebP encoding tries `sharp`, then `cwebp`, then Python Pillow; PNG is kept if none is available.
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "out");
const dest = path.join(root, "public", "hero");
if (!fs.existsSync(path.join(out, "index.html"))) {
  console.error("No out/index.html. Run `npm run build` first.");
  process.exit(1);
}
fs.mkdirSync(dest, { recursive: true });

const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2", ".json": "application/json" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  let f = path.join(out, p);
  if (!f.startsWith(out)) return res.writeHead(403).end();
  if (!fs.existsSync(f) && fs.existsSync(f + ".html")) f += ".html";
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return res.writeHead(404).end();
  res.setHeader("content-type", types[path.extname(f)] || "application/octet-stream");
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const launch = { headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] };
if (process.env.PW_CHROMIUM) launch.executablePath = process.env.PW_CHROMIUM;
else launch.channel = "chrome";
const browser = await chromium.launch(launch);

async function render(width, height, file) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(`${base}/?hero=full&nodrip`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => {
    const c = document.querySelector("section[data-hero-mode] canvas");
    const w = c && c.closest("div[aria-hidden]");
    return !!w && getComputedStyle(w).opacity === "1";
  }, null, { timeout: 60000 });
  await page.waitForTimeout(5500); // the entrance has settled
  await page.evaluate(() => {
    const s = document.querySelector("section[data-hero-mode]");
    for (const el of s.children) if (!el.querySelector("canvas")) el.style.visibility = "hidden";
    for (const el of document.querySelectorAll("body *")) {
      if (!s.contains(el) && !el.contains(s) && getComputedStyle(el).position === "fixed") el.style.visibility = "hidden";
    }
  });
  await page.waitForTimeout(300);
  await page.locator("section[data-hero-mode] canvas").locator("xpath=..").screenshot({ path: file });
  await ctx.close();
  console.log("rendered", path.relative(root, file));
}

async function toWebp(png) {
  const webp = png.replace(/\.png$/, ".webp");
  try {
    const sharp = (await import("sharp")).default;
    await sharp(png).webp({ quality: 82 }).toFile(webp);
  } catch {
    try {
      execFileSync("cwebp", ["-q", "82", png, "-o", webp], { stdio: "ignore" });
    } catch {
      try {
        execFileSync("python3", ["-c", `from PIL import Image; Image.open(${JSON.stringify(png)}).convert("RGB").save(${JSON.stringify(webp)}, "WEBP", quality=82, method=6)`], { stdio: "inherit" });
      } catch {
        console.warn("No WebP encoder found (sharp, cwebp or Pillow). Kept", path.relative(root, png));
        return;
      }
    }
  }
  fs.unlinkSync(png);
  console.log("encoded", path.relative(root, webp), `${(fs.statSync(webp).size / 1024).toFixed(0)} KB`);
}

try {
  await render(1920, 1080, path.join(dest, "rise-still.png"));
  await render(1080, 1920, path.join(dest, "rise-still-portrait.png"));
  await toWebp(path.join(dest, "rise-still.png"));
  await toWebp(path.join(dest, "rise-still-portrait.png"));
} finally {
  await browser.close();
  server.close();
}
