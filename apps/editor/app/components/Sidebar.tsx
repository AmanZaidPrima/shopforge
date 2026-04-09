"use client";

import { useCallback } from "react";
import type { PageRoute, SelectedSection } from "./EditorShell";
import type { SectionSetting, SectionSettingType } from "../../lib/api";

interface SidebarProps {
  activePage: PageRoute;
  pages: PageRoute[];
  onPageChange: (page: PageRoute) => void;
  selected: SelectedSection | null;
  onDeselect: () => void;
  onPropChange: (settingId: string, value: unknown, settingType: SectionSettingType) => void;
  onSave: () => void;
  saving: boolean;
}

const PAGE_ICONS: Record<string, string> = {
  home: "⌂",
  products: "◻",
  collections: "▦",
  cart: "◎",
};

export default function Sidebar({
  activePage,
  pages,
  onPageChange,
  selected,
  onDeselect,
  onPropChange,
  onSave,
  saving,
}: SidebarProps) {
  return (
    <div className="w-[260px] bg-[#242424] border-r border-[#333] flex flex-col shrink-0 h-full">
      {selected ? (
        <SectionPanel
          selected={selected}
          onDeselect={onDeselect}
          onPropChange={onPropChange}
          onSave={onSave}
          saving={saving}
        />
      ) : (
        <PageList activePage={activePage} pages={pages} onPageChange={onPageChange} />
      )}
    </div>
  );
}

// ── Page nav (default view) ──────────────────────────────────────────────────

function PageButton({
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
      {isActive && <span className="ml-auto w-1 h-1 rounded-full bg-[#5c6ac4]" />}
    </button>
  );
}

function PageList({
  activePage,
  pages,
  onPageChange,
}: {
  activePage: PageRoute;
  pages: PageRoute[];
  onPageChange: (p: PageRoute) => void;
}) {
  return (
    <>
      <div className="px-4 pt-3.5 pb-2.5 border-b border-[#2e2e2e] text-[#666] text-[10px] font-bold tracking-[0.08em] uppercase">
        Pages
      </div>
      <nav className="flex-1 p-2 overflow-y-auto">
        {pages.map((page) => (
          <PageButton
            key={page.key}
            page={page}
            isActive={activePage.key === page.key}
            onPageChange={onPageChange}
          />
        ))}
      </nav>
      <div className="px-4 py-2.5 border-t border-[#2e2e2e]">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#4caf50] shrink-0" />
          <span className="text-[#666] text-[11px]">Storefront live</span>
        </div>
        <div className="mt-1 text-[#444] text-[10px] font-mono">localhost:3000</div>
      </div>
    </>
  );
}

// ── Section settings panel ───────────────────────────────────────────────────

function SectionPanel({
  selected,
  onDeselect,
  onPropChange,
  onSave,
  saving,
}: {
  selected: SelectedSection;
  onDeselect: () => void;
  onPropChange: (id: string, value: unknown, settingType: SectionSettingType) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const { schema, props } = selected;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#2e2e2e]">
        <button
          onClick={onDeselect}
          className="w-6 h-6 flex items-center justify-center rounded text-[#666] hover:text-[#ccc] hover:bg-[#333] border-0 bg-transparent cursor-pointer text-xs"
          title="Back"
        >
          ←
        </button>
        <span className="text-[#e0e0e0] text-[13px] font-semibold truncate">
          {schema?.name ?? selected.sectionType}
        </span>
      </div>

      {/* Settings */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {!schema || schema.settings.length === 0 ? (
          <p className="text-[#555] text-[12px] italic mt-2">No settings for this section.</p>
        ) : (
          schema.settings.map((setting) => (
            <SettingField
              key={setting.id}
              setting={setting}
              value={props[setting.id] ?? setting.default ?? ""}
              onPropChange={onPropChange}
            />
          ))
        )}
      </div>

      {/* Save */}
      {schema && schema.settings.length > 0 && (
        <div className="p-3 border-t border-[#2e2e2e]">
          <button
            onClick={onSave}
            disabled={saving}
            className={`w-full py-2 rounded-md text-[13px] font-semibold border-0 cursor-pointer transition-all duration-150 ${
              saving
                ? "bg-[#3a3a5a] text-[#7878aa] cursor-not-allowed"
                : "bg-[#5c6ac4] text-white hover:bg-[#4a58b0]"
            }`}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Individual setting fields ────────────────────────────────────────────────

function SettingField({
  setting,
  value,
  onPropChange,
}: {
  setting: SectionSetting;
  value: unknown;
  onPropChange: (id: string, value: unknown, settingType: SectionSettingType) => void;
}) {
  const labelClass = "block text-[#888] text-[11px] mb-1";
  const inputClass =
    "w-full bg-[#1e1e1e] border border-[#3a3a3a] rounded px-2.5 py-1.5 text-[#e0e0e0] text-[12px] outline-none focus:border-[#5c6ac4] transition-colors";

  const handleRangeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onPropChange(setting.id, Number(e.target.value), setting.type),
    [setting.id, setting.type, onPropChange]
  );
  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onPropChange(setting.id, e.target.value, setting.type),
    [setting.id, setting.type, onPropChange]
  );

  if (setting.type === "range") {
    const num = typeof value === "number" ? value : Number(value);
    return (
      <div>
        <label className={labelClass}>
          {setting.label}
          <span className="ml-1 text-[#5c6ac4]">{num}</span>
        </label>
        <input
          type="range"
          min={setting.min}
          max={setting.max}
          step={setting.step}
          value={num}
          onChange={handleRangeChange}
          className="w-full accent-[#5c6ac4] h-1.5 cursor-pointer"
        />
        <div className="flex justify-between text-[#444] text-[10px] mt-0.5">
          <span>{setting.min}</span>
          <span>{setting.max}</span>
        </div>
      </div>
    );
  }

  if (setting.type === "color") {
    return (
      <div>
        <label className={labelClass}>{setting.label}</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={String(value)}
            onChange={handleTextChange}
            className="w-8 h-8 rounded border border-[#3a3a3a] bg-transparent cursor-pointer p-0"
          />
          <input
            type="text"
            value={String(value)}
            onChange={handleTextChange}
            className={inputClass}
          />
        </div>
      </div>
    );
  }

  // text + url
  return (
    <div>
      <label className={labelClass}>{setting.label}</label>
      <input
        type="text"
        value={String(value)}
        onChange={handleTextChange}
        className={inputClass}
      />
    </div>
  );
}
