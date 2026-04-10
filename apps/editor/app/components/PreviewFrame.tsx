"use client";

import { RefObject, useState } from "react";
import type { PreviewWidth } from "./EditorShell";

interface PreviewFrameProps {
  src: string;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  width: string;
  previewWidth: PreviewWidth;
}

export default function PreviewFrame({ src, iframeRef, width, previewWidth }: PreviewFrameProps) {
  const [loading, setLoading] = useState(false);

  const isConstrained = previewWidth !== "desktop";

  // Strip the ?editor=1 param for display
  const displayUrl = src.replace("?editor=1", "");

  return (
    <div className="flex-1 flex flex-col bg-gray-100 min-w-0">
      {/* URL bar */}
      <div className="h-10 bg-white border-b border-gray-200 flex items-center justify-between px-5 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0 w-2 h-2 rounded-full bg-green-500" />
          <span className="text-[11px] text-gray-500 font-mono truncate">{displayUrl}</span>
        </div>
        <span className="text-[11px] text-gray-400 font-medium shrink-0 ml-4">Live preview</span>
      </div>

      {/* Canvas */}
      <div className={`flex-1 flex overflow-auto ${isConstrained ? "justify-center items-start p-8" : "items-stretch p-4"}`}>
        <div
          className={`relative bg-white overflow-hidden transition-[width] duration-200 ease-in-out ${
            isConstrained
              ? "rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.10)] border border-gray-200"
              : "rounded-xl border border-gray-200 w-full"
          }`}
          style={{
            width: isConstrained ? width : "100%",
            height: isConstrained ? "calc(100vh - 130px)" : "100%",
          }}
        >
          {loading && (
            <div className="absolute inset-0 bg-white flex items-center justify-center z-10">
              <div className="w-5 h-5 border-2 border-[#e5e7eb] border-t-[#3b82f6] rounded-full animate-spin" />
            </div>
          )}
          <iframe
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
    </div>
  );
}
