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

export type Store = {
  id: string;
  name: string;
  hostname: string;
};

export type ThemeSettings = {
  id: string;
  brand_color: string;
  font_family: string;
  border_radius: number;
};

export type RenderContext = {
  store: Store;
  theme: ThemeSettings;
  routeParams: Record<string, string>;
};

export type ThemeSchema = {
  settings_schema: Record<string, { type: string; default: unknown; label: string }>;
  default_layouts: Record<string, PageLayout>;
};

export type StoreRecord = {
  store: Store;
  themeSettings: ThemeSettings;
};

export type AppEnv = {
  Variables: {
    isHtmx: boolean;
    store: Store;
    themeSettings: ThemeSettings;
  };
};
