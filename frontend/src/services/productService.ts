import { api } from './api';
import { Product } from '../types';

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
