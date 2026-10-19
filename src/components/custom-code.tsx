"use client";

import { useEffect } from "react";

/*
 * Code an agency pasted for a site or funnel (a chat widget, a tag manager,
 * a pixel with custom events). Markup set through innerHTML never runs its
 * scripts, so each <script> is re-created; everything is removed again
 * when the visitor moves to another page.
 */
export function CustomCode({ html, target }: { html: string | undefined; target: "head" | "body" }) {
  useEffect(() => {
    if (!html?.trim()) return;
    const parent = target === "head" ? document.head : document.body;
    const tpl = document.createElement("template");
    tpl.innerHTML = html;
    const added: Node[] = [];
    for (const node of Array.from(tpl.content.childNodes)) {
      let out: Node = node;
      if (node instanceof HTMLScriptElement) {
        const s = document.createElement("script");
        for (const a of Array.from(node.attributes)) s.setAttribute(a.name, a.value);
        s.text = node.text;
        out = s;
      }
      parent.appendChild(out);
      added.push(out);
    }
    return () => added.forEach((n) => n.parentNode?.removeChild(n));
  }, [html, target]);
  return null;
}
