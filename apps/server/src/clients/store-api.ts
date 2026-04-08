import { STORE_API } from "../config.ts";

export async function fetchProducts(storeId: string, limit: number): Promise<unknown[]> {
  const res = await fetch(`${STORE_API}/stores/${storeId}/products?limit=${limit}`);
  return res.ok ? (res.json() as Promise<unknown[]>) : [];
}

export async function fetchProduct(storeId: string, handle: string): Promise<unknown | null> {
  const res = await fetch(`${STORE_API}/stores/${storeId}/products/${handle}`);
  return res.ok ? res.json() : null;
}

export async function fetchCollection(storeId: string, handle: string): Promise<unknown | null> {
  const res = await fetch(`${STORE_API}/stores/${storeId}/collections/${handle}`);
  return res.ok ? res.json() : null;
}

export async function fetchCollectionProducts(
  storeId: string,
  handle: string,
  limit: number
): Promise<unknown[]> {
  const res = await fetch(`${STORE_API}/stores/${storeId}/collections/${handle}/products?limit=${limit}`);
  return res.ok ? (res.json() as Promise<unknown[]>) : [];
}

export async function fetchPage(storeId: string, handle: string): Promise<unknown | null> {
  const res = await fetch(`${STORE_API}/stores/${storeId}/pages/${handle}`);
  return res.ok ? res.json() : null;
}
