"use client";

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
      <div className="flex items-center gap-2.5 min-w-[200px]">
        <div className="w-7 h-7 bg-[#5c6ac4] rounded-md flex items-center justify-center text-white font-bold text-[13px]">
          SF
        </div>
        <span className="text-[#e0e0e0] font-semibold text-[13px]">ShopForge</span>
      </div>

      {/* Center: Page picker */}
      <div className="flex items-center gap-1.5">
        {pages.map((page) => {
          const isActive = activePage.key === page.key;
          return (
            <button
              key={page.key}
              onClick={() => onPageChange(page)}
              className={`px-3 py-1 rounded-md border-0 cursor-pointer text-xs transition-all duration-150 ${
                isActive
                  ? "bg-[#5c6ac4] text-white font-semibold"
                  : "bg-transparent text-[#aaa] font-normal hover:text-[#ddd]"
              }`}
            >
              {page.label}
            </button>
          );
        })}
      </div>

      {/* Right: viewport toggles + external link */}
      <div className="flex items-center gap-1.5 min-w-[200px] justify-end">
        {(["desktop", "tablet", "mobile"] as PreviewWidth[]).map((w) => (
          <button
            key={w}
            onClick={() => onPreviewWidthChange(w)}
            title={w}
            className={`w-[30px] h-7 rounded border-0 cursor-pointer text-sm transition-all duration-150 ${
              previewWidth === w
                ? "bg-[#3d3d3d] text-[#e0e0e0]"
                : "bg-transparent text-[#666] hover:text-[#aaa]"
            }`}
          >
            {ICONS[w]}
          </button>
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
