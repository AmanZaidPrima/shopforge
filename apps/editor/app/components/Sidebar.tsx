"use client";

import type { PageRoute } from "./EditorShell";

interface SidebarProps {
  activePage: PageRoute;
  pages: PageRoute[];
  onPageChange: (page: PageRoute) => void;
}

const PAGE_ICONS: Record<string, string> = {
  home: "⌂",
  products: "◻",
  collections: "▦",
  cart: "◎",
};

export default function Sidebar({ activePage, pages, onPageChange }: SidebarProps) {
  return (
    <div className="w-[260px] bg-[#242424] border-r border-[#333] flex flex-col shrink-0 h-full">
      {/* Section header */}
      <div className="px-4 pt-3.5 pb-2.5 border-b border-[#2e2e2e] text-[#666] text-[10px] font-bold tracking-[0.08em] uppercase">
        Pages
      </div>

      {/* Page list */}
      <nav className="flex-1 p-2 overflow-y-auto">
        {pages.map((page) => {
          const isActive = activePage.key === page.key;
          return (
            <button
              key={page.key}
              onClick={() => onPageChange(page)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md border-0 cursor-pointer text-[13px] text-left transition-all duration-150 mb-0.5 ${
                isActive
                  ? "bg-[#2e2e3e] text-[#c5c8ff] font-semibold"
                  : "bg-transparent text-[#aaa] font-normal hover:bg-[#2a2a2a] hover:text-[#ccc]"
              }`}
            >
              <span className={`w-5 text-center text-sm ${isActive ? "opacity-100" : "opacity-50"}`}>
                {PAGE_ICONS[page.key] ?? "◻"}
              </span>
              {page.label}
              {isActive && (
                <span className="ml-auto w-1 h-1 rounded-full bg-[#5c6ac4]" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom status */}
      <div className="px-4 py-2.5 border-t border-[#2e2e2e]">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#4caf50] shrink-0" />
          <span className="text-[#666] text-[11px]">Storefront live</span>
        </div>
        <div className="mt-1 text-[#444] text-[10px] font-mono">localhost:3000</div>
      </div>
    </div>
  );
}
