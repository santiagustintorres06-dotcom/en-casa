import type { HouseholdState } from '../types/shopping.ts';
import { parseState } from './storage.ts';
export const emptyHousehold = (): HouseholdState => ({ version: 2, products: [], manualItems: [], selections: {}, completedOperations: [] });
export function encodeState(s: HouseholdState): Map<string, Record<string, unknown>> {
  const docs = new Map<string, Record<string, unknown>>();
  for (const p of s.products) docs.set(`p_${p.id}`, { kind: 'product', ...p });
  for (const p of s.manualItems) docs.set(`m_${p.id}`, { kind: 'manual', ...p });
  for (const [productId, selection] of Object.entries(s.selections)) docs.set(`s_${productId}`, { kind: 'selection', productId, ...selection });
  for (const operationId of s.completedOperations) docs.set(`o_${operationId}`, { kind: 'operation', operationId });
  return docs;
}
export function decodeState(docs: { id: string; data: Record<string, unknown> }[]): { state: HouseholdState; revision: number } {
  const state = emptyHousehold();
  let revision = -1;
  for (const { id, data } of docs) {
    const { kind, ...fields } = data;
    if (id === '_version' && kind === 'version' && Number.isInteger(data.revision)) revision = Number(data.revision);
    else if (kind === 'product') state.products.push(fields as never);
    else if (kind === 'manual') state.manualItems.push(fields as never);
    else if (kind === 'selection' && typeof fields.productId === 'string') {
      const { productId, ...selection } = fields;
      state.selections[productId] = selection as never;
    } else if (kind === 'operation' && typeof fields.operationId === 'string') state.completedOperations.push(fields.operationId);
    else throw new Error('El hogar contiene datos de una versión incompatible.');
  }
  if (revision < 0) throw new Error('Falta la versión de datos del hogar.');
  return { state: parseState(JSON.stringify(state)), revision };
}
