"use client";

import { useRef, useState } from "react";
import { ImageUp, Link2, Loader2, X } from "lucide-react";
import { ASSET_MAX_BYTES, ASSET_TYPES } from "@/lib/assets";
import { cn } from "@/lib/utils";

/*
 * Pick an image for a site or funnel: upload one from the computer (drop
 * it on the box or click), or paste a link. Uploads go to /api/assets and
 * come back as a public address, which is what gets saved.
 */

type Shape = "photo" | "logo" | "icon";

const boxShape: Record<Shape, string> = {
  photo: "aspect-[16/9] w-full",
  logo: "h-16 w-full",
  icon: "size-16",
};

export function ImagePicker({
  value,
  onChange,
  label,
  shape = "photo",
  hint,
  accept,
}: {
  value: string | undefined;
  onChange: (url: string) => void;
  label: string;
  shape?: Shape;
  hint?: string;
  /** Narrow the file types, e.g. "image/png,image/x-icon" for a favicon. */
  accept?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pasting, setPasting] = useState(false);
  const [over, setOver] = useState(false);

  async function upload(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!ASSET_TYPES[file.type]) return setError("Use a PNG, JPG, WebP, GIF, SVG or ICO image.");
    if (file.size > ASSET_MAX_BYTES) return setError("Images can be up to 4 MB.");
    setBusy(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/assets", { method: "POST", body });
      const out = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !out?.url) setError(out?.error ?? "The upload didn't finish. Try again.");
      else onChange(out.url);
    } catch {
      setError("The upload didn't finish. Check your connection and try again.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className={cn("flex gap-2", shape === "icon" ? "items-center" : "flex-col")}>
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            void upload(e.dataTransfer.files[0]);
          }}
          disabled={busy}
          aria-label={value ? `Replace ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
          className={cn(
            "group relative grid shrink-0 place-items-center overflow-hidden rounded-md border text-fg-3 transition-colors",
            boxShape[shape],
            value ? "border-line bg-[repeating-conic-gradient(var(--surface-2)_0_25%,var(--surface)_0_50%)] bg-[length:12px_12px]" : "border-dashed border-line-strong bg-surface-2/60 hover:border-brand hover:text-brand",
            over && "border-brand bg-brand/5 text-brand",
          )}
        >
          {value ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={value} alt="" className={cn("absolute inset-0 size-full", shape === "photo" ? "object-cover" : "object-contain p-1.5")} />
              <span className="absolute inset-0 grid place-items-center bg-rail/60 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">Replace</span>
            </>
          ) : (
            <span className="flex flex-col items-center gap-1 px-2 text-center text-xs">
              <ImageUp className="size-4" aria-hidden />
              {shape !== "icon" && <span>Drop an image or click to upload</span>}
            </span>
          )}
          {busy && (
            <span className="absolute inset-0 grid place-items-center bg-surface/80">
              <Loader2 className="size-4 animate-spin text-fg-2" aria-label="Uploading" />
            </span>
          )}
        </button>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <button type="button" onClick={() => input.current?.click()} disabled={busy} className="font-medium text-brand hover:underline disabled:opacity-50">
            {value ? "Replace" : "Upload"}
          </button>
          <button type="button" onClick={() => setPasting((v) => !v)} className="inline-flex items-center gap-1 text-fg-2 hover:text-fg">
            <Link2 className="size-3" aria-hidden />
            Paste a link
          </button>
          {value && (
            <button type="button" onClick={() => onChange("")} className="inline-flex items-center gap-1 text-fg-2 hover:text-red">
              <X className="size-3" aria-hidden />
              Remove
            </button>
          )}
        </div>
      </div>
      {pasting && (
        <input
          aria-label={`${label} link`}
          value={value ?? ""}
          placeholder="https://"
          onChange={(e) => onChange(e.target.value.trim())}
          className="h-[30px] w-full rounded border border-line-strong bg-surface px-2 text-[13px] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
        />
      )}
      <input ref={input} type="file" accept={accept ?? Object.keys(ASSET_TYPES).join(",")} className="sr-only" tabIndex={-1} onChange={(e) => void upload(e.target.files?.[0])} />
      {error ? <p className="text-[11px] leading-4 text-red">{error}</p> : hint && <p className="text-[11px] leading-4 text-fg-3">{hint}</p>}
    </div>
  );
}
