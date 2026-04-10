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

function DesktopIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}
function TabletIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" strokeLinecap="round" />
    </svg>
  );
}
function MobileIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" strokeLinecap="round" />
    </svg>
  );
}
function ExternalIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}
function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

const VIEWPORT_ICON: Record<PreviewWidth, React.ReactNode> = {
  desktop: <DesktopIcon />,
  tablet: <TabletIcon />,
  mobile: <MobileIcon />,
};

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
  const handlePageSelect = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const page = pages.find((p) => p.key === e.target.value);
      if (page) onPageChange(page);
    },
    [pages, onPageChange]
  );

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-4 shrink-0">

      {/* Left — wordmark + context */}
      <div className="flex items-center gap-1 shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center shadow-sm">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="2" width="5.5" height="5.5" rx="1" fill="white" fillOpacity="0.9"/>
              <rect x="8.5" y="2" width="5.5" height="5.5" rx="1" fill="white" fillOpacity="0.6"/>
              <rect x="2" y="8.5" width="5.5" height="5.5" rx="1" fill="white" fillOpacity="0.6"/>
              <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" fill="white" fillOpacity="0.3"/>
            </svg>
          </div>
          <span className="text-[13px] font-semibold text-gray-900 tracking-tight">ShopForge</span>
        </div>
        <svg className="text-gray-300 mx-1" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 18l6-6-6-6"/>
        </svg>
        <span className="text-[13px] text-gray-500 font-medium">Editor</span>
      </div>

      {/* Center — page dropdown + viewport toggles */}
      <div className="flex-1 flex items-center justify-center gap-3">

        {/* Page / template dropdown */}
        <div className="relative">
          <select
            value={activePage.key}
            onChange={handlePageSelect}
            className="appearance-none bg-white border border-gray-200 rounded-lg pl-3 pr-8 h-8 text-[13px] font-medium text-gray-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
          >
            {pages.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
            <ChevronDownIcon />
          </span>
        </div>

        <div className="w-px h-5 bg-gray-200 shrink-0" />

        {/* Viewport toggles */}
        <div className="flex items-center gap-0.5">
          {VIEWPORT_WIDTHS.map((w) => (
            <button
              key={w}
              title={w.charAt(0).toUpperCase() + w.slice(1)}
              onClick={() => onPreviewWidthChange(w)}
              className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${
                previewWidth === w
                  ? "bg-gray-900 text-white"
                  : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              }`}
            >
              {VIEWPORT_ICON[w]}
            </button>
          ))}
        </div>
      </div>

      {/* Right — preview + publish */}
      <div className="flex items-center gap-2 shrink-0">
        <a
          href={`${storefrontUrl}${activePage.path}`}
          target="_blank"
          rel="noopener noreferrer"
          className="h-8 px-3 flex items-center gap-1.5 text-[12px] font-medium text-gray-600 no-underline border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          Preview <ExternalIcon />
        </a>
        <button
          onClick={onPublish}
          disabled={publishing}
          className={`h-8 px-4 rounded-lg text-[12px] font-semibold border-0 transition-colors ${
            publishing
              ? "bg-blue-400 text-white cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
          }`}
        >
          {publishing ? "Saving…" : "Publish"}
        </button>
      </div>
    </header>
  );
}
