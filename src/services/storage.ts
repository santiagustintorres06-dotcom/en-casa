import type { Product } from '../types/product';
import { validateProduct } from './stock';
const KEY = 'encasa.inventory.v1';
export function loadProducts(): Product[] {
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data) || !data.every(p => p && typeof p === 'object' && typeof p.id === 'string' && typeof p.updatedAt === 'string' && typeof p.name === 'string' && validateProduct(p) === null) || new Set(data.map(p => p.id)).size !== data.length) throw new Error('Los datos guardados no tienen el formato esperado. No los sobrescribimos.');
  return data;
}
export const saveProducts = (products: Product[]) => localStorage.setItem(KEY, JSON.stringify(products));
