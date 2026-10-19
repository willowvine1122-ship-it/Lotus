import "server-only";

/*
 * The Lotus look for the emails Lotus itself sends (invites, password
 * resets, team alerts). Emails a client sends to their own leads stay plain.
 * Email clients ignore most CSS, so this is tables and inline styles only.
 */

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const linkify = (s: string) =>
  esc(s).replace(/(https?:\/\/[^\s<]+|\{\{app\}\}[^\s<]*)/g, (u) => `<a href="${u}" style="color:#5b2fd6;word-break:break-all">${u}</a>`);

export function lotusEmailHtml({ origin, text, action, note }: { origin: string; text: string; action?: { label: string; url: string }; note?: string }) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#3f434c">${linkify(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const button = action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="border-radius:8px;background:#6d3df2"><a href="${esc(action.url)}" style="display:inline-block;padding:12px 20px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none">${esc(action.label)}</a></td></tr></table>`
    : "";
  const small = note ? `<p style="margin:0;font-size:13px;line-height:20px;color:#6b7079">${linkify(note)}</p>` : "";
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f8f7f4">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f7f4;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
<tr><td style="padding:0 4px 20px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="padding-right:10px"><img src="${origin}/brand/icon-48.png" width="28" height="28" alt="" style="display:block;border-radius:6px"></td>
<td style="font-size:18px;font-weight:600;letter-spacing:-0.3px;color:#16181d">Lotus</td>
</tr></table></td></tr>
<tr><td style="background:#ffffff;border:1px solid #e3e0d8;border-radius:12px;padding:32px 28px">${paragraphs}${button}${small}</td></tr>
<tr><td style="padding:20px 4px 0;font-size:12px;line-height:18px;color:#6b7079">Sent by Lotus for The Lotus Digital.</td></tr>
</table></td></tr></table></body></html>`;
}
