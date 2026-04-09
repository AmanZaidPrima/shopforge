"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Sidebar from "./Sidebar";
import PreviewFrame from "./PreviewFrame";
import TopBar from "./TopBar";
import type { SectionSchema, SectionSettingType } from "../../lib/api";
import { fetchSectionSchema, fetchLayout, saveLayout, previewSection } from "../../lib/api";

const CLIENT_PATCH_TYPES: SectionSettingType[] = ["text", "url"];
const STOREFRONT_BASE = process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "http://localhost:3000";
const STORE_ID = "store-1";
const THEME_ID = "dawn";
const PREVIEW_DEBOUNCE_MS = 400;

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

export interface SelectedSection {
  sectionId: string;
  sectionType: string;
  schema: SectionSchema | null;
  props: Record<string, unknown>;
}

export interface LayoutSection {
  id: string;
  type: string;
}

export default function EditorShell() {
  const [activePage, setActivePage] = useState<PageRoute>(PAGE_ROUTES[0]);
  const [previewWidth, setPreviewWidth] = useState<PreviewWidth>("desktop");
  const [selected, setSelected] = useState<SelectedSection | null>(null);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [layoutSections, setLayoutSections] = useState<LayoutSection[]>([]);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const editRef = useRef<SelectedSection | null>(null);
  const layoutRef = useRef<Awaited<ReturnType<typeof fetchLayout>>>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setEdit = useCallback((next: SelectedSection | null) => {
    editRef.current = next;
    setSelected(next);
  }, []);

  const iframeSrc = `${STOREFRONT_BASE}${activePage.path}?editor=1`;

  useEffect(() => {
    fetchLayout(STORE_ID, activePage.key).then((l) => {
      layoutRef.current = l;
      setLayoutSections(l?.sections.filter((s) => !s.disabled).map((s) => ({ id: s.id, type: s.type })) ?? []);
    });
  }, [activePage.key]);

  const selectSection = useCallback(async (sectionId: string, sectionType: string) => {
    iframeRef.current?.contentWindow?.postMessage({ type: "sf:section:select", sectionId }, "*");
    const [schema, layout] = await Promise.all([
      fetchSectionSchema(THEME_ID, sectionType),
      layoutRef.current ? Promise.resolve(layoutRef.current) : fetchLayout(STORE_ID, activePage.key),
    ]);
    layoutRef.current = layout;
    const section = layout?.sections.find((s) => s.id === sectionId);
    setEdit({ sectionId, sectionType, schema, props: section?.props ?? {} });
  }, [activePage.key, setEdit]);

  useEffect(() => {
    async function onMessage(e: MessageEvent) {
      if (!e.data || e.data.type !== "sf:section:click") return;
      const { sectionId, sectionType } = e.data as { sectionId: string; sectionType: string };
      await selectSection(sectionId, sectionType);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [selectSection]);

  const handlePageChange = useCallback((page: PageRoute) => {
    setActivePage(page);
    setEdit(null);
    iframeRef.current?.contentWindow?.postMessage({ type: "sf:deselect" }, "*");
  }, [setEdit]);

  const handleDeselect = useCallback(() => {
    setEdit(null);
    iframeRef.current?.contentWindow?.postMessage({ type: "sf:deselect" }, "*");
  }, [setEdit]);

  const handlePropChange = useCallback((settingId: string, value: unknown, settingType: SectionSettingType) => {
    const prev = editRef.current;
    if (!prev) return;

    const next = { ...prev, props: { ...prev.props, [settingId]: value } };
    setEdit(next);

    if (CLIENT_PATCH_TYPES.includes(settingType)) {
      iframeRef.current?.contentWindow?.postMessage(
        { type: "sf:setting:patch", sectionId: prev.sectionId, settingId, settingType, value },
        "*"
      );
    } else {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(async () => {
        const snap = editRef.current;
        if (!snap) return;

        const html = await previewSection(snap.sectionId, snap.sectionType, snap.props);
        if (!html) return;

        iframeRef.current?.contentWindow?.postMessage(
          { type: "sf:section:patch", sectionId: snap.sectionId, html },
          "*"
        );

        const current = editRef.current;
        if (!current || current.sectionId !== snap.sectionId || !current.schema) return;
        for (const setting of current.schema.settings) {
          if (!CLIENT_PATCH_TYPES.includes(setting.type)) continue;
          iframeRef.current?.contentWindow?.postMessage(
            { type: "sf:setting:patch", sectionId: current.sectionId, settingId: setting.id, settingType: setting.type, value: current.props[setting.id] },
            "*"
          );
        }
      }, PREVIEW_DEBOUNCE_MS);
    }
  }, [setEdit]);

  const handlePublish = useCallback(async () => {
    const current = editRef.current;
    if (!current || !layoutRef.current) return;
    if (debounceTimer.current) { clearTimeout(debounceTimer.current); debounceTimer.current = null; }
    setSaving(true);

    const updatedLayout = {
      ...layoutRef.current,
      sections: layoutRef.current.sections.map((s) =>
        s.id === current.sectionId ? { ...s, props: current.props } : s
      ),
    };

    await saveLayout(STORE_ID, activePage.key, updatedLayout);
    layoutRef.current = updatedLayout;
    setReloadKey((k) => k + 1);
    setSaving(false);
  }, [activePage.key]);

  return (
    <div className="flex flex-col h-screen">
      <TopBar
        activePage={activePage}
        pages={PAGE_ROUTES}
        onPageChange={handlePageChange}
        previewWidth={previewWidth}
        onPreviewWidthChange={setPreviewWidth}
        storefrontUrl={STOREFRONT_BASE}
        onPublish={handlePublish}
        publishing={saving}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          sections={layoutSections}
          selectedId={selected?.sectionId ?? null}
          onSectionSelect={selectSection}
          selected={selected}
          onDeselect={handleDeselect}
          onPropChange={handlePropChange}
        />
        <PreviewFrame
          src={iframeSrc}
          iframeRef={iframeRef}
          width={PREVIEW_WIDTHS[previewWidth]}
          previewWidth={previewWidth}
          reloadKey={reloadKey}
        />
      </div>
    </div>
  );
}
