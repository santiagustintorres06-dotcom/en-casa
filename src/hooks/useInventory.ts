import { useState } from 'react';
import type { Product, ProductInput } from '../types/product';
import { loadProducts, saveProducts } from '../services/storage';
import { validateProduct } from '../services/stock';
export function useInventory() {
  const [initial] = useState(() => { try { return { products: loadProducts(), error: '' }; } catch (e) { return { products: [] as Product[], error: e instanceof Error ? e.message : 'No pudimos leer el almacenamiento local.' }; } });
  const [products, setProducts] = useState(initial.products);
  const [error, setError] = useState(initial.error);
  function commit(next: Product[]) {
    if (initial.error) return false;
    try { saveProducts(next); setProducts(next); setError(''); return true; }
    catch { setError('No pudimos guardar. Revisá el espacio y los permisos del navegador.'); return false; }
  }
  function upsert(input: ProductInput, id?: string) {
    const error = validateProduct(input); if (error) { setError(error); return false; }
    const p: Product = { ...input, name: input.name.trim(), id: id ?? crypto.randomUUID(), updatedAt: new Date().toISOString() };
    return commit(id ? products.map(old => old.id === id ? p : old) : [...products, p]);
  }
  return { products, error, upsert, remove: (id: string) => commit(products.filter(p => p.id !== id)), empty: (id: string) => commit(products.map(p => p.id === id ? { ...p, quantity: 0, updatedAt: new Date().toISOString() } : p)), adjust: (id: string, delta: number) => commit(products.map(p => p.id === id ? { ...p, quantity: Math.round(Math.max(0, Math.min(100000, p.quantity + delta)) * 1000) / 1000, updatedAt: new Date().toISOString() } : p)) };
}
