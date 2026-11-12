"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * Projector page: a big black-and-white QR code for this site.
 * Uses the URL the page is served from (so it is always the deployed URL),
 * or ?url=... to point somewhere else.
 */
export function QrView() {
  const [url, setUrl] = useState("");
  const [svg, setSvg] = useState("");

  useEffect(() => {
    const override = new URLSearchParams(window.location.search).get("url");
    const target = override || `${window.location.origin}/reviews`;
    QRCode.toString(target, { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: "#000000", light: "#ffffff" } })
      .then((s) => {
        setUrl(target);
        setSvg(s);
      })
      .catch(() => setUrl(target));
  }, []);

  const shown = url.replace(/^https?:\/\//, "").replace(/\/reviews$/, "");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-[3vh] bg-white px-6 py-8 text-black">
      <p className="text-[clamp(1.25rem,3vw,2.5rem)] font-bold tracking-tight">CourseRevAI</p>
      <div
        className="aspect-square w-[min(70vh,86vw)] [&>svg]:h-full [&>svg]:w-full"
        role="img"
        aria-label={url ? `QR code for ${url}` : "QR code loading"}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <p className="text-center font-mono text-[clamp(1.1rem,3.2vw,2.75rem)] font-semibold tracking-tight [overflow-wrap:anywhere]">{shown}</p>
      <p className="text-[clamp(0.9rem,1.6vw,1.25rem)] text-neutral-600">Scan to read course reviews and chat with Broddy</p>
    </main>
  );
}
