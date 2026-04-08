export type Product = {
  id: string;
  handle: string;
  title: string;
  price: string;
  image: string;
  description: string;
  variants: { id: string; title: string }[];
};

export type Collection = {
  handle: string;
  title: string;
  description: string;
  productIds: string[];
};

export type Page = {
  handle: string;
  title: string;
  content: string;
};
