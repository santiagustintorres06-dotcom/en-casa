import { useRef, useState } from "react";
import type { Product, ProductInput } from "../types/product";
import type {
  HouseholdState,
  ManualItem,
  ShoppingRow,
} from "../types/shopping";
import { loadHousehold, saveHousehold } from "../services/storage";
import { validateProduct } from "../services/stock";
import { finishShopping, shoppingRows } from "../services/shopping";
import { emptyHousehold } from "../services/cloudState";
import type { InventoryPort } from "../types/inventoryPort";

export function useInventory(port?: InventoryPort) {
  const [initial] = useState(() => {
    try {
      return {
        ...(port
          ? { state: emptyHousehold(), serialized: null }
          : loadHousehold()),
        error: "",
      };
    } catch (e) {
      return {
        state: {
          version: 2,
          products: [],
          manualItems: [],
          selections: {},
          completedOperations: [],
        } as HouseholdState,
        serialized: null,
        error:
          e instanceof Error
            ? e.message
            : "No pudimos leer el almacenamiento local.",
      };
    }
  });
  const [state, setState] = useState(initial.state);
  const [error, setError] = useState(initial.error);
  const current = useRef(initial.state);
  const serialized = useRef(initial.serialized);
  function commit(change: (s: HouseholdState) => HouseholdState) {
    if (port) {
      const ok = port.commit(change);
      if (ok) setError("");
      return ok;
    }
    if (initial.error) return false;
    try {
      const next = change(current.current);
      if (next === current.current) return true;
      serialized.current = saveHousehold(next, serialized.current);
      current.current = next;
      setState(next);
      setError("");
      return true;
    } catch (e) {
      setError(
        e instanceof Error &&
          e.name !== "QuotaExceededError" &&
          e.name !== "SecurityError"
          ? e.message
          : "No pudimos guardar. Revisá el espacio y los permisos del navegador.",
      );
      return false;
    }
  }
  function upsert(input: ProductInput, id?: string) {
    const invalid = validateProduct(input);
    if (invalid) {
      setError(invalid);
      return false;
    }
    const p: Product = {
      ...input,
      name: input.name.trim(),
      id: id ?? crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
    };
    return commit((s) => {
      const selections = { ...s.selections };
      delete selections[p.id];
      return {
        ...s,
        selections,
        products: id
          ? s.products.map((old) => (old.id === id ? p : old))
          : [...s.products, p],
      };
    });
  }
  function updateStock(id: string, change: (quantity: number) => number) {
    return commit((s) => {
      const selections = { ...s.selections };
      delete selections[id];
      return {
        ...s,
        selections,
        products: s.products.map((p) =>
          p.id === id
            ? {
                ...p,
                quantity: change(p.quantity),
                updatedAt: new Date().toISOString(),
              }
            : p,
        ),
      };
    });
  }
  function addManual(input: Omit<ManualItem, "id" | "checked">) {
    const invalid = validateProduct({ ...input, minimumStock: 0 });
    if (invalid || input.quantity <= 0) {
      setError(invalid ?? "La cantidad a comprar debe ser mayor a cero.");
      return false;
    }
    return commit((s) => ({
      ...s,
      manualItems: [
        ...s.manualItems,
        {
          ...input,
          name: input.name.trim(),
          id: crypto.randomUUID(),
          checked: false,
        },
      ],
    }));
  }
  function updateShopping(
    row: ShoppingRow,
    change: { checked?: boolean; quantity?: number },
  ) {
    if (
      change.quantity !== undefined &&
      (!Number.isFinite(change.quantity) ||
        change.quantity <= 0 ||
        change.quantity > 100000)
    ) {
      setError("La cantidad a comprar debe ser mayor a cero y hasta 100.000.");
      return false;
    }
    return commit((s) => {
      const live = shoppingRows(s).find(
        (p) => p.source === row.source && p.id === row.id,
      );
      if (!live) throw new Error("Este producto ya no está en la lista.");
      return row.source === "manual"
        ? {
            ...s,
            manualItems: s.manualItems.map((p) =>
              p.id === row.id ? { ...p, ...change } : p,
            ),
          }
        : {
            ...s,
            selections: {
              ...s.selections,
              [row.id]: {
                checked: live.checked,
                quantity: live.quantity,
                unit: live.unit,
                ...change,
              },
            },
          };
    });
  }
  const visible = port?.state ?? state;
  return {
    products: visible.products,
    state: visible,
    rows: shoppingRows(visible),
    error: port?.error || error,
    upsert,
    addManual,
    updateShopping,
    finish: (operationId: string) =>
      commit((s) => finishShopping(s, operationId, new Date().toISOString())),
    removeManual: (id: string) =>
      commit((s) => ({
        ...s,
        manualItems: s.manualItems.filter((p) => p.id !== id),
      })),
    remove: (id: string) =>
      commit((s) => {
        const selections = { ...s.selections };
        delete selections[id];
        return {
          ...s,
          selections,
          products: s.products.filter((p) => p.id !== id),
        };
      }),
    empty: (id: string) => updateStock(id, () => 0),
    adjust: (id: string, delta: number) =>
      updateStock(
        id,
        (quantity) =>
          Math.round(Math.max(0, Math.min(100000, quantity + delta)) * 1000) /
          1000,
      ),
  };
}
