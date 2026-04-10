"use client";

import { useCallback, useState } from "react";
import type { LayoutSection, SelectedSection } from "./EditorShell";
import type { SectionSetting } from "../../lib/api";

interface SidebarProps {
  sections: LayoutSection[];
  selectedId: string | null;
  onSectionSelect: (sectionId: string, sectionType: string) => void;
  selected: SelectedSection | null;
  onDeselect: () => void;
  onPropChange: (settingId: string, value: unknown) => void;
  templateContent: string | null;
  onTemplateSave: (content: string) => Promise<boolean>;
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
  templateContent,
  onTemplateSave,
}: SidebarProps) {
  return (
    <div className="w-[280px] bg-white border-r border-gray-200 flex flex-col shrink-0 h-full">
      {/* Sections list */}
      <SectionList
        sections={sections}
        selectedId={selectedId}
        onSectionSelect={onSectionSelect}
      />

      {/* Settings/Code panel — shown when a section is selected */}
      {selected && (
        <SettingsPanel
          key={selected.sectionId}
          selected={selected}
          onDeselect={onDeselect}
          onPropChange={onPropChange}
          templateContent={templateContent}
          onTemplateSave={onTemplateSave}
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
      className={`w-full flex items-center gap-3 px-4 py-3 border-0 cursor-pointer text-left transition-colors group ${
        isActive ? "bg-blue-50" : "bg-transparent hover:bg-gray-50"
      }`}
    >
      {/* left accent bar */}
      <span className={`shrink-0 w-0.5 h-4 rounded-full transition-colors ${
        isActive ? "bg-blue-600" : "bg-gray-200 group-hover:bg-gray-300"
      }`} />
      {/* drag handle dots */}
      <span className="shrink-0 flex flex-col gap-[3px] opacity-25 group-hover:opacity-50">
        <span className="flex gap-[3px]">
          <span className="w-[3px] h-[3px] rounded-full bg-gray-500" />
          <span className="w-[3px] h-[3px] rounded-full bg-gray-500" />
        </span>
        <span className="flex gap-[3px]">
          <span className="w-[3px] h-[3px] rounded-full bg-gray-500" />
          <span className="w-[3px] h-[3px] rounded-full bg-gray-500" />
        </span>
      </span>
      <span className={`flex-1 text-[13px] truncate ${
        isActive ? "text-blue-700 font-semibold" : "text-gray-700 font-medium"
      }`}>
        {formatSectionType(section.type)}
      </span>
      {isActive && (
        <svg className="shrink-0 text-blue-500" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
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
    <div className="border-b border-gray-200">
      <div className="px-4 py-3 flex items-center justify-between">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sections</span>
        <span className="text-[10px] font-semibold text-gray-300">{sections.length}</span>
      </div>
      <div>
        {sections.length === 0 ? (
          <div className="px-4 py-4 text-[12px] text-gray-400 italic">No sections on this page.</div>
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

type PanelTab = "settings" | "code";

function SettingsPanel({ selected, onDeselect, onPropChange, templateContent, onTemplateSave }: {
  selected: SelectedSection;
  onDeselect: () => void;
  onPropChange: (id: string, value: unknown) => void;
  templateContent: string | null;
  onTemplateSave: (content: string) => Promise<boolean>;
}) {
  const { schema, props } = selected;
  const [activeTab, setActiveTab] = useState<PanelTab>("settings");

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Panel header */}
      <div className="px-4 pt-3.5 pb-0 border-b border-gray-200 bg-gray-50 shrink-0">
        <div className="flex items-center gap-2.5 mb-3">
          <button
            onClick={onDeselect}
            title="Back"
            className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200 border-0 bg-transparent cursor-pointer transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <span className="text-[13px] font-semibold text-gray-900 truncate">
            {schema?.name ?? formatSectionType(selected.sectionType)}
          </span>
        </div>
        {/* Tabs */}
        <div className="flex gap-1">
          {(["settings", "code"] as PanelTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-[12px] font-medium rounded-t-md border-0 cursor-pointer transition-colors capitalize ${
                activeTab === tab
                  ? "bg-white text-gray-900 shadow-[0_-1px_0_0_white_inset] border border-b-0 border-gray-200"
                  : "bg-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "settings" ? (
        <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-5">
          {!schema || schema.settings.length === 0 ? (
            <p className="text-[12px] text-gray-400 italic">No settings for this section.</p>
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
      ) : (
        <CodePanel
          templateContent={templateContent}
          onTemplateSave={onTemplateSave}
        />
      )}
    </div>
  );
}

// ── Code panel ───────────────────────────────────────────────────────────────

function CodePanel({ templateContent, onTemplateSave }: {
  templateContent: string | null;
  onTemplateSave: (content: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  // When templateContent loads (or changes to a new section), reset draft
  const value = draft ?? templateContent ?? "";
  const isDirty = draft !== null && draft !== templateContent;

  const handleSave = useCallback(async () => {
    if (!isDirty) return;
    setSaving(true);
    setError(false);
    const ok = await onTemplateSave(draft!);
    setSaving(false);
    if (ok) {
      setDraft(null);
    } else {
      setError(true);
    }
  }, [isDirty, draft, onTemplateSave]);

  if (templateContent === null) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-[12px] text-gray-400">Loading template…</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <textarea
        value={value}
        onChange={(e) => setDraft(e.target.value)}
        spellCheck={false}
        className="flex-1 w-full resize-none font-mono text-[11.5px] leading-relaxed text-gray-800 bg-gray-950 p-4 outline-none border-0"
        style={{ color: "#e2e8f0", caretColor: "#e2e8f0" }}
      />
      <div className="flex items-center justify-between px-3 py-2 bg-gray-950 border-t border-gray-800 shrink-0">
        {error ? (
          <span className="text-[11px] text-red-400">Save failed — check template syntax</span>
        ) : (
          <span className="text-[11px] text-gray-500">
            {isDirty ? "Unsaved changes" : "No changes"}
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={!isDirty || saving}
          className={`h-7 px-3 rounded text-[11px] font-semibold border-0 transition-colors ${
            isDirty && !saving
              ? "bg-blue-600 text-white cursor-pointer hover:bg-blue-500"
              : "bg-gray-700 text-gray-500 cursor-not-allowed"
          }`}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ── Setting fields ───────────────────────────────────────────────────────────

function SettingField({ setting, value, onPropChange }: {
  setting: SectionSetting;
  value: unknown;
  onPropChange: (id: string, value: unknown) => void;
}) {
  const labelClass = "block text-[11px] font-semibold text-[#6b7280] uppercase tracking-wide mb-1.5";
  const inputClass =
    "w-full px-3 py-2 rounded-lg border border-[#d1d5db] text-[13px] text-[#111827] bg-white outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors";

  const handleRangeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onPropChange(setting.id, Number(e.target.value)),
    [setting.id, onPropChange]
  );
  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onPropChange(setting.id, e.target.value),
    [setting.id, onPropChange]
  );

  if (setting.type === "range") {
    const num = typeof value === "number" ? value : Number(value);
    return (
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className={labelClass + " mb-0"}>{setting.label}</label>
          <span className="text-[12px] font-semibold text-gray-900 tabular-nums">{num}</span>
        </div>
        <input
          type="range"
          min={setting.min}
          max={setting.max}
          step={setting.step}
          value={num}
          onChange={handleRangeChange}
          className="w-full accent-black h-1 cursor-pointer"
        />
        <div className="flex justify-between text-[#9ca3af] text-[10px] mt-1">
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
            className="w-10 h-9 rounded-lg border border-[#d1d5db] cursor-pointer p-0.5 bg-white shrink-0"
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
