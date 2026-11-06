import type { Product } from './product';

export type ShoppingSelection = { checked: boolean; quantity: number; unit: Product['unit'] };
export type ManualItem = { id: string; name: string; category: Product['category']; unit: Product['unit']; quantity: number; checked: boolean };
export type HouseholdState = { version: 2; products: Product[]; manualItems: ManualItem[]; selections: Record<string, ShoppingSelection>; completedOperations: string[] };
export type ShoppingRow = ManualItem & { source: 'inventory' | 'manual'; currentStock?: number };
