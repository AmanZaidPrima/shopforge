"use client";

import { useCallback } from "react";
import type { LayoutSection, SelectedSection } from "./EditorShell";
import type { SectionSetting, SectionSettingType } from "../../lib/api";

interface SidebarProps {
  sections: LayoutSection[];
  selectedId: string | null;
  onSectionSelect: (sectionId: string, sectionType: string) => void;
  selected: SelectedSection | null;
  onDeselect: () => void;
  onPropChange: (settingId: string, value: unknown, settingType: SectionSettingType) => void;
}

// Converts "hero-banner" → "Hero Banner"
function formatSectionType(type: string): string {
  return type.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Sidebar({
  sections,
  selectedId,
  onSectionSelect,
  selected,
  onDeselect,
  onPropChange,
}: SidebarProps) {
  return (
    <div className="w-[300px] bg-white border-r border-[#e5e7eb] flex flex-col shrink-0 h-full">
      {/* Sections list */}
      <SectionList
        sections={sections}
        selectedId={selectedId}
        onSectionSelect={onSectionSelect}
      />

      {/* Settings panel — shown when a section is selected */}
      {selected && (
        <SettingsPanel
          selected={selected}
          onDeselect={onDeselect}
          onPropChange={onPropChange}
        />
      )}
    </div>
  );
}

// ── Sections list ────────────────────────────────────────────────────────────

function SectionRow({ section, isActive, onSectionSelect }: {
  section: LayoutSection;
  isActive: boolean;
  onSectionSelect: (id: string, type: string) => void;
}) {
  const handleClick = useCallback(
    () => onSectionSelect(section.id, section.type),
    [section.id, section.type, onSectionSelect]
  );
  return (
    <button
      onClick={handleClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 border-0 cursor-pointer text-left transition-colors group ${
        isActive ? "bg-[#eff6ff]" : "bg-transparent hover:bg-[#f9fafb]"
      }`}
    >
      {/* left accent bar */}
      <span className={`shrink-0 w-0.5 h-5 rounded-full transition-colors ${
        isActive ? "bg-[#3b82f6]" : "bg-[#e5e7eb] group-hover:bg-[#d1d5db]"
      }`} />
      {/* drag handle dots */}
      <span className="shrink-0 flex flex-col gap-[3px] opacity-30 group-hover:opacity-60">
        <span className="flex gap-[3px]">
          <span className="w-[3px] h-[3px] rounded-full bg-[#6b7280]" />
          <span className="w-[3px] h-[3px] rounded-full bg-[#6b7280]" />
        </span>
        <span className="flex gap-[3px]">
          <span className="w-[3px] h-[3px] rounded-full bg-[#6b7280]" />
          <span className="w-[3px] h-[3px] rounded-full bg-[#6b7280]" />
        </span>
      </span>
      <span className={`flex-1 text-[13px] truncate ${
        isActive ? "text-[#1d4ed8] font-semibold" : "text-[#374151] font-medium"
      }`}>
        {formatSectionType(section.type)}
      </span>
      {isActive && (
        <svg className="shrink-0 text-[#3b82f6]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      )}
    </button>
  );
}

function SectionList({ sections, selectedId, onSectionSelect }: {
  sections: LayoutSection[];
  selectedId: string | null;
  onSectionSelect: (id: string, type: string) => void;
}) {
  return (
    <div className="border-b border-[#e5e7eb]">
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-[#f3f4f6]">
        <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-[0.1em]">Sections</span>
        <span className="text-[10px] text-[#d1d5db]">{sections.length}</span>
      </div>
      <div className="py-1">
        {sections.length === 0 ? (
          <div className="px-4 py-3 text-[12px] text-[#9ca3af] italic">No sections on this page.</div>
        ) : (
          sections.map((section) => (
            <SectionRow
              key={section.id}
              section={section}
              isActive={selectedId === section.id}
              onSectionSelect={onSectionSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Settings panel ───────────────────────────────────────────────────────────

function SettingsPanel({ selected, onDeselect, onPropChange }: {
  selected: SelectedSection;
  onDeselect: () => void;
  onPropChange: (id: string, value: unknown, settingType: SectionSettingType) => void;
}) {
  const { schema, props } = selected;

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Panel header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#e5e7eb]">
        <button
          onClick={onDeselect}
          title="Back"
          className="w-6 h-6 flex items-center justify-center rounded text-[#9ca3af] hover:text-[#374151] hover:bg-[#f3f4f6] border-0 bg-transparent cursor-pointer transition-colors"
        >
          ←
        </button>
        <span className="text-[13px] font-semibold text-[#111827] truncate">
          {schema?.name ?? formatSectionType(selected.sectionType)}
        </span>
      </div>

      {/* Fields */}
      <div className="p-4 flex flex-col gap-4">
        {!schema || schema.settings.length === 0 ? (
          <p className="text-[12px] text-[#9ca3af] italic">No settings for this section.</p>
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
    </div>
  );
}

// ── Setting fields ───────────────────────────────────────────────────────────

function SettingField({ setting, value, onPropChange }: {
  setting: SectionSetting;
  value: unknown;
  onPropChange: (id: string, value: unknown, settingType: SectionSettingType) => void;
}) {
  const labelClass = "block text-[12px] font-semibold text-[#6b7280] mb-1";
  const inputClass =
    "w-full px-3 py-2 rounded-md border border-[#d1d5db] text-[13px] text-[#111827] outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] transition-colors";

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
          <span className="ml-1.5 font-normal text-[#3b82f6]">{num}</span>
        </label>
        <input
          type="range"
          min={setting.min}
          max={setting.max}
          step={setting.step}
          value={num}
          onChange={handleRangeChange}
          className="w-full accent-[#3b82f6] h-1.5 cursor-pointer"
        />
        <div className="flex justify-between text-[#9ca3af] text-[10px] mt-0.5">
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
        <div className="flex gap-2 items-center">
          <input
            type="color"
            value={String(value)}
            onChange={handleTextChange}
            className="w-9 h-8 rounded border border-[#d1d5db] cursor-pointer p-0.5 bg-white"
          />
          <input
            type="text"
            value={String(value)}
            onChange={handleTextChange}
            className={`${inputClass} font-mono`}
          />
        </div>
      </div>
    );
  }

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
