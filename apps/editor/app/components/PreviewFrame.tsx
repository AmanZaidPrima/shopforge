"use client";

import { RefObject, useState } from "react";
import type { PreviewWidth } from "./EditorShell";

interface PreviewFrameProps {
  src: string;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  width: string;
  previewWidth: PreviewWidth;
  reloadKey: number;
}

export default function PreviewFrame({ src, iframeRef, width, previewWidth, reloadKey }: PreviewFrameProps) {
  const [loading, setLoading] = useState(false);

  const isConstrained = previewWidth !== "desktop";

  return (
    <div
      className={`flex-1 flex justify-center overflow-auto ${
        isConstrained ? "items-start py-6 bg-[#1a1a1a]" : "items-stretch"
      }`}
    >
      <div
        className={`relative bg-white shrink-0 overflow-hidden transition-[width] duration-250 ease-in-out ${
          isConstrained ? "rounded-lg shadow-[0_8px_40px_rgba(0,0,0,0.6)]" : ""
        }`}
        style={{
          width,
          height: isConstrained ? "calc(100vh - 96px)" : "100%",
        }}
      >
        {loading && (
          <div className="absolute inset-0 bg-[#f5f5f5] flex items-center justify-center z-10 text-[#999] text-[13px] gap-2">
            <LoadingSpinner />
            Loading preview…
          </div>
        )}

        <iframe
          key={reloadKey}
          ref={iframeRef}
          src={src}
          className="w-full h-full border-0 block"
          onLoad={() => setLoading(false)}
          onLoadStart={() => setLoading(true)}
          title="Storefront preview"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="w-4 h-4 border-2 border-[#ddd] border-t-[#5c6ac4] rounded-full animate-spin" />
  );
}
