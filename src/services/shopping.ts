import type { Product } from "../types/product.ts";
import type { HouseholdState, ShoppingRow } from "../types/shopping.ts";
import { isLowStock, validateProduct } from "./stock.ts";

// Three decimal places, shared with inventory controls. Always suggest enough to exceed the minimum.
export const suggestedQuantity = (p: Product) =>
  Math.max(
    1,
    Math.min(
      100000 - p.quantity,
      Math.round((p.minimumStock - p.quantity + 1) * 1000) / 1000,
    ),
  );
export function shoppingRows(state: HouseholdState): ShoppingRow[] {
  return [
    ...state.products.filter(isLowStock).map((p) => {
      const selection =
        state.selections[p.id]?.unit === p.unit
          ? state.selections[p.id]
          : undefined;
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        unit: p.unit,
        quantity: selection?.quantity ?? suggestedQuantity(p),
        checked: selection?.checked ?? false,
        source: "inventory" as const,
        currentStock: p.quantity,
      };
    }),
    ...state.manualItems.map((p) => ({ ...p, source: "manual" as const })),
  ];
}

export function finishShopping(
  state: HouseholdState,
  operationId: string,
  now: string,
): HouseholdState {
  if (state.completedOperations.includes(operationId)) return state;
  const bought = shoppingRows(state).filter((p) => p.checked);
  if (!bought.length)
    throw new Error("Tildá al menos un producto para terminar la compra.");
  let products = [...state.products];
  for (const item of bought) {
    if (
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0 ||
      item.quantity > 100000
    )
      throw new Error(`Revisá la cantidad de ${item.name}.`);
    if (item.source === "inventory") {
      products = products.map((p) =>
        p.id === item.id
          ? { ...p, quantity: p.quantity + item.quantity, updatedAt: now }
          : p,
      );
    } else {
      products.push({
        id: `manual-${item.id}`,
        name: item.name,
        category: item.category,
        unit: item.unit,
        quantity: item.quantity,
        minimumStock: 0,
        updatedAt: now,
      });
    }
  }
  if (products.some((p) => validateProduct(p)))
    throw new Error(
      "La compra supera el máximo de stock permitido (100.000). Ajustá la cantidad.",
    );
  const selections = { ...state.selections };
  bought
    .filter((p) => p.source === "inventory")
    .forEach((p) => delete selections[p.id]);
  return {
    ...state,
    products,
    selections,
    manualItems: state.manualItems.filter((p) => !p.checked),
    completedOperations: [...state.completedOperations, operationId],
  };
}
