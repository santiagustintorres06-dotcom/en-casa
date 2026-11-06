import type { Product } from "../types/product.ts";
import type { HouseholdState } from "../types/shopping.ts";
import { validateProduct } from "./stock.ts";

export const STATE_KEY = "encasa.household.v2";
const LEGACY_KEY = "encasa.inventory.v1";
type StoragePort = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const uniqueIds = (items: { id: string }[]) =>
  new Set(items.map((p) => p.id)).size === items.length;
function validProducts(value: unknown): value is Product[] {
  return (
    Array.isArray(value) &&
    value.every(
      (p) =>
        record(p) &&
        typeof p.id === "string" &&
        p.id.length > 0 &&
        typeof p.updatedAt === "string" &&
        typeof p.name === "string" &&
        !validateProduct(p as Product),
    ) &&
    uniqueIds(value)
  );
}
export function parseState(raw: string): HouseholdState {
  const data: unknown = JSON.parse(raw);
  if (
    !record(data) ||
    data.version !== 2 ||
    !validProducts(data.products) ||
    !Array.isArray(data.manualItems) ||
    !data.manualItems.every(
      (p) =>
        record(p) &&
        typeof p.id === "string" &&
        p.id.length > 0 &&
        typeof p.name === "string" &&
        typeof p.checked === "boolean" &&
        typeof p.quantity === "number" &&
        p.quantity > 0 &&
        !validateProduct({ ...p, minimumStock: 0 } as never),
    ) ||
    !uniqueIds(data.manualItems) ||
    !record(data.selections) ||
    !Object.values(data.selections).every(
      (s) =>
        record(s) &&
        typeof s.checked === "boolean" &&
        typeof s.quantity === "number" &&
        Number.isFinite(s.quantity) &&
        s.quantity > 0 &&
        s.quantity <= 100000 &&
        typeof s.unit === "string" &&
        !validateProduct({
          name: "selection",
          category: "Otros",
          quantity: s.quantity,
          unit: s.unit,
          minimumStock: 0,
        } as never),
    ) ||
    !Array.isArray(data.completedOperations) ||
    !data.completedOperations.every((id) => typeof id === "string")
  )
    throw new Error(
      "Los datos guardados no tienen el formato esperado. No los sobrescribimos.",
    );
  return data as HouseholdState;
}
export function loadHousehold(storage: StoragePort = localStorage): {
  state: HouseholdState;
  serialized: string | null;
} {
  const raw = storage.getItem(STATE_KEY);
  if (raw !== null) return { state: parseState(raw), serialized: raw };
  const old = storage.getItem(LEGACY_KEY);
  const products: unknown = old === null ? [] : JSON.parse(old);
  if (!validProducts(products))
    throw new Error(
      "El inventario anterior es inválido. No lo sobrescribimos.",
    );
  return {
    state: {
      version: 2,
      products,
      manualItems: [],
      selections: {},
      completedOperations: [],
    },
    serialized: null,
  };
}
export function saveHousehold(
  state: HouseholdState,
  expected: string | null,
  storage: StoragePort = localStorage,
): string {
  if (storage.getItem(STATE_KEY) !== expected)
    throw new Error(
      "El inventario cambió en otra pestaña. Recargá antes de seguir para conservar esos cambios.",
    );
  const raw = JSON.stringify(state);
  parseState(raw);
  // One atomic setItem saves stock, list and operation receipt together.
  storage.setItem(STATE_KEY, raw);
  return raw;
}
