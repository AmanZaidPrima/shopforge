"use client";

import { useCallback } from "react";
import type { PageRoute, PreviewWidth } from "./EditorShell";

interface TopBarProps {
  activePage: PageRoute;
  pages: PageRoute[];
  onPageChange: (page: PageRoute) => void;
  previewWidth: PreviewWidth;
  onPreviewWidthChange: (w: PreviewWidth) => void;
  storefrontUrl: string;
  onPublish: () => void;
  publishing: boolean;
}

const VIEWPORT_WIDTHS: PreviewWidth[] = ["desktop", "tablet", "mobile"];

const ViewportIcon = ({ width }: { width: PreviewWidth }) => {
  if (width === "desktop") return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
    </svg>
  );
  if (width === "tablet") return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="2" width="16" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18.01"/>
    </svg>
  );
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="7" y="2" width="10" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18.01"/>
    </svg>
  );
};

function ViewportButton({ width, isActive, onPreviewWidthChange }: {
  width: PreviewWidth;
  isActive: boolean;
  onPreviewWidthChange: (w: PreviewWidth) => void;
}) {
  const handleClick = useCallback(() => onPreviewWidthChange(width), [width, onPreviewWidthChange]);
  return (
    <button
      onClick={handleClick}
      title={width}
      className={`w-8 h-8 flex items-center justify-center rounded cursor-pointer border-0 transition-colors ${
        isActive ? "bg-[#333] text-white" : "bg-transparent text-[#888] hover:text-[#ccc]"
      }`}
    >
      <ViewportIcon width={width} />
    </button>
  );
}

function PageTab({ page, isActive, onPageChange }: {
  page: PageRoute;
  isActive: boolean;
  onPageChange: (p: PageRoute) => void;
}) {
  const handleClick = useCallback(() => onPageChange(page), [page, onPageChange]);
  return (
    <button
      onClick={handleClick}
      className={`px-3 h-8 rounded text-[12px] font-medium border-0 cursor-pointer transition-colors ${
        isActive ? "bg-[#333] text-white" : "bg-transparent text-[#888] hover:text-[#ccc]"
      }`}
    >
      {page.label}
    </button>
  );
}

export default function TopBar({
  activePage,
  pages,
  onPageChange,
  previewWidth,
  onPreviewWidthChange,
  storefrontUrl,
  onPublish,
  publishing,
}: TopBarProps) {
  return (
    <div className="h-12 bg-[#1a1a1a] border-b border-[#2a2a2a] flex items-center px-3 gap-3 shrink-0">
      {/* Left: logo + page tabs */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-6 h-6 bg-[#5c6ac4] rounded flex items-center justify-center text-white font-bold text-[11px] shrink-0">
          SF
        </div>
        <span className="text-[#555] text-[12px] shrink-0">/</span>
        <div className="flex items-center gap-0.5">
          {pages.map((page) => (
            <PageTab
              key={page.key}
              page={page}
              isActive={activePage.key === page.key}
              onPageChange={onPageChange}
            />
          ))}
        </div>
      </div>

      {/* Center: viewport toggles */}
      <div className="flex-1 flex items-center justify-center gap-1">
        {VIEWPORT_WIDTHS.map((w) => (
          <ViewportButton
            key={w}
            width={w}
            isActive={previewWidth === w}
            onPreviewWidthChange={onPreviewWidthChange}
          />
        ))}
      </div>

      {/* Right: open link + publish */}
      <div className="flex items-center gap-2 shrink-0">
        <a
          href={`${storefrontUrl}${activePage.path}`}
          target="_blank"
          rel="noopener noreferrer"
          className="h-8 px-3 flex items-center text-[12px] text-[#888] no-underline border border-[#333] rounded hover:text-[#ccc] hover:border-[#444] transition-colors"
        >
          Preview ↗
        </a>
        <button
          onClick={onPublish}
          disabled={publishing}
          className={`h-8 px-4 rounded text-[12px] font-bold border-0 cursor-pointer transition-colors ${
            publishing
              ? "bg-[#7f1d1d] text-[#fca5a5] cursor-not-allowed"
              : "bg-[#dc2626] text-white hover:bg-[#b91c1c]"
          }`}
        >
          {publishing ? "Publishing…" : "Publish to Live"}
        </button>
        <div className="flex items-center gap-1.5">
          <span className="text-[#4ade80] text-[10px]">●</span>
        </div>
      </div>
    </div>
  );
}
