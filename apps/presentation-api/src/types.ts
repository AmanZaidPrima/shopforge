export type Section = {
  id: string;
  type: string;
  disabled?: boolean;
  props: Record<string, unknown>;
};

export type PageLayout = {
  meta: { title: string; description?: string };
  sections: Section[];
};

export type ThemeSettingsValues = {
  brand_color: string;
  font_family: string;
  border_radius: number;
};

export type ThemeSchema = {
  settings_schema: Record<string, { type: string; default: unknown; label: string; options?: string[]; min?: number; max?: number }>;
  default_layouts: Record<string, PageLayout>;
};

export type Store = {
  id: string;
  name: string;
  hostname: string;
};

// Per-store theme config — mirrors KV key `stores:{store_id}:active_theme`
export type StoreTheme = {
  theme_id: string;
  settings: ThemeSettingsValues;
  layout_overrides: Record<string, PageLayout>;
};
