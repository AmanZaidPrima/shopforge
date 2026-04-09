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
}

const ICONS: Record<PreviewWidth, string> = {
  desktop: "🖥",
  tablet: "▭",
  mobile: "📱",
};

const VIEWPORT_WIDTHS: PreviewWidth[] = ["desktop", "tablet", "mobile"];

function PageTab({
  page,
  isActive,
  onPageChange,
}: {
  page: PageRoute;
  isActive: boolean;
  onPageChange: (p: PageRoute) => void;
}) {
  const handleClick = useCallback(() => onPageChange(page), [page, onPageChange]);
  return (
    <button
      onClick={handleClick}
      className={`px-3 py-1 rounded-md border-0 cursor-pointer text-xs transition-all duration-150 ${
        isActive
          ? "bg-[#5c6ac4] text-white font-semibold"
          : "bg-transparent text-[#aaa] font-normal hover:text-[#ddd]"
      }`}
    >
      {page.label}
    </button>
  );
}

function ViewportButton({
  width,
  isActive,
  onPreviewWidthChange,
}: {
  width: PreviewWidth;
  isActive: boolean;
  onPreviewWidthChange: (w: PreviewWidth) => void;
}) {
  const handleClick = useCallback(() => onPreviewWidthChange(width), [width, onPreviewWidthChange]);
  return (
    <button
      onClick={handleClick}
      title={width}
      className={`w-7.5 h-7 rounded border-0 cursor-pointer text-sm transition-all duration-150 ${
        isActive
          ? "bg-[#3d3d3d] text-[#e0e0e0]"
          : "bg-transparent text-[#666] hover:text-[#aaa]"
      }`}
    >
      {ICONS[width]}
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
}: TopBarProps) {
  return (
    <div className="h-12 bg-[#2c2c2c] border-b border-[#3a3a3a] flex items-center justify-between px-3 shrink-0 gap-3">
      {/* Left: Logo + store name */}
      <div className="flex items-center gap-2.5 min-w-50">
        <div className="w-7 h-7 bg-[#5c6ac4] rounded-md flex items-center justify-center text-white font-bold text-[13px]">
          SF
        </div>
        <span className="text-[#e0e0e0] font-semibold text-[13px]">ShopForge</span>
      </div>

      {/* Center: Page picker */}
      <div className="flex items-center gap-1.5">
        {pages.map((page) => (
          <PageTab
            key={page.key}
            page={page}
            isActive={activePage.key === page.key}
            onPageChange={onPageChange}
          />
        ))}
      </div>

      {/* Right: viewport toggles + external link */}
      <div className="flex items-center gap-1.5 min-w-50 justify-end">
        {VIEWPORT_WIDTHS.map((w) => (
          <ViewportButton
            key={w}
            width={w}
            isActive={previewWidth === w}
            onPreviewWidthChange={onPreviewWidthChange}
          />
        ))}

        <div className="w-px h-5 bg-[#3a3a3a] mx-1" />

        <a
          href={`${storefrontUrl}${activePage.path}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in new tab"
          className="px-2.5 py-1 rounded-md border border-[#3a3a3a] text-[#aaa] text-[11px] no-underline transition-all duration-150 whitespace-nowrap hover:border-[#555] hover:text-[#ccc]"
        >
          Open ↗
        </a>
      </div>
    </div>
  );
}
