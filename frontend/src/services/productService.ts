import { api } from './api';
import { Product, ProductVariant } from '../types';

export interface ProductQuery {
  brand?: string;
  category?: string;
  search?: string;
}

export async function getProducts(query: ProductQuery = {}): Promise<Product[]> {
  const { data } = await api.get<Product[]>('/products', { params: query });
  return data;
}

export async function getProduct(id: string): Promise<Product> {
  const { data } = await api.get<Product>(`/products/${id}`);
  return data;
}

export interface ProductInput {
  name: string;
  brand: string;
  category: string;
  description?: string;
  priceCents: number;
  imageUrl?: string;
}

// Staff-only: create a new catalogue product (starts with zero stock everywhere).
export async function createProduct(input: ProductInput): Promise<Product> {
  const { data } = await api.post<Product>('/products', input);
  return data;
}

// Staff-only: edit an existing product. An empty imageUrl clears it to fallback art.
export async function updateProduct(id: string, changes: Partial<ProductInput>): Promise<Product> {
  const { data } = await api.patch<Product>(`/products/${id}`, changes);
  return data;
}

// Staff-only: replace a product's colour variants (array order = display position).
export async function setProductVariants(
  id: string,
  variants: { color: string; imageUrl: string }[],
): Promise<ProductVariant[]> {
  const { data } = await api.put<ProductVariant[]>(`/products/${id}/variants`, { variants });
  return data;
}

// Staff-only: list retired (archived) products.
export async function getArchivedProducts(): Promise<Product[]> {
  const { data } = await api.get<Product[]>('/products/archived');
  return data;
}

// Staff-only: remove a product. The server permanently deletes it if it has never been
// ordered, otherwise it archives it (to preserve order history) — `mode` says which.
export async function deleteProduct(id: string): Promise<{ mode: 'deleted' | 'archived'; name: string }> {
  const { data } = await api.delete<{ mode: 'deleted' | 'archived'; name: string }>(`/products/${id}`);
  return data;
}

// Staff-only: restore a retired product back into the catalogue.
export async function restoreProduct(id: string): Promise<Product> {
  const { data } = await api.post<Product>(`/products/${id}/restore`);
  return data;
}
