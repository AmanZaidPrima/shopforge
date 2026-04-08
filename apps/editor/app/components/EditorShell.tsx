"use client";

import { useState, useRef, useCallback } from "react";
import Sidebar from "./Sidebar";
import PreviewFrame from "./PreviewFrame";
import TopBar from "./TopBar";

const STOREFRONT_BASE = process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "http://localhost:3000";

export type PageRoute =
  | { key: "home"; label: "Home"; path: "/" }
  | { key: "products"; label: "Products"; path: "/products/example-product" }
  | { key: "collections"; label: "Collections"; path: "/collections/all" }
  | { key: "cart"; label: "Cart"; path: "/cart" };

export const PAGE_ROUTES: PageRoute[] = [
  { key: "home", label: "Home", path: "/" },
  { key: "products", label: "Products", path: "/products/example-product" },
  { key: "collections", label: "Collections", path: "/collections/all" },
  { key: "cart", label: "Cart", path: "/cart" },
];

export type PreviewWidth = "desktop" | "tablet" | "mobile";

export const PREVIEW_WIDTHS: Record<PreviewWidth, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "390px",
};

export default function EditorShell() {
  const [activePage, setActivePage] = useState<PageRoute>(PAGE_ROUTES[0]);
  const [previewWidth, setPreviewWidth] = useState<PreviewWidth>("desktop");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const iframeSrc = `${STOREFRONT_BASE}${activePage.path}?editor=1`;

  const handlePageChange = useCallback((page: PageRoute) => {
    setActivePage(page);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-[#1a1a1a]">
      <TopBar
        activePage={activePage}
        pages={PAGE_ROUTES}
        onPageChange={handlePageChange}
        previewWidth={previewWidth}
        onPreviewWidthChange={setPreviewWidth}
        storefrontUrl={STOREFRONT_BASE}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar activePage={activePage} pages={PAGE_ROUTES} onPageChange={handlePageChange} />
        <PreviewFrame
          src={iframeSrc}
          iframeRef={iframeRef}
          width={PREVIEW_WIDTHS[previewWidth]}
          previewWidth={previewWidth}
        />
      </div>
    </div>
  );
}
