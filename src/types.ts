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
