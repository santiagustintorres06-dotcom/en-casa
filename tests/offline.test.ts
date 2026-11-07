import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyHousehold } from "../src/services/cloudState.ts";
import {
  replayChange,
  type OfflineChange,
} from "../src/services/offlineChanges.ts";
import { finishShopping } from "../src/services/shopping.ts";
import {
  queueChange,
  queuedChanges,
  acknowledgeChange,
  clearAppData,
} from "../src/services/offlineStorage.ts";
const base = () => ({
  ...emptyHousehold(),
  products: [
    {
      id: "rice",
      name: "Arroz",
      category: "Almacén" as const,
      unit: "un" as const,
      quantity: 1,
      minimumStock: 1,
      updatedAt: "before",
    },
  ],
});
test("reconcilia movimientos de stock offline sin pisar una reposición remota", () => {
  const before = base(),
    after = base(),
    remote = base();
  after.products[0].quantity = 0;
  remote.products[0].quantity = 5;
  const change: OfflineChange = { id: "sync-1", createdAt: 1, before, after };
  const result = replayChange(remote, change);
  assert.equal(result.products[0].quantity, 4);
  assert.equal(replayChange(result, change), result);
});
test("una compra offline suma siete unidades una sola vez aunque se reenvíe", () => {
  const before = base();
  before.products[0].quantity = 0;
  before.selections.rice = { checked: true, quantity: 7, unit: "un" };
  const change = {
    id: "sync-2",
    createdAt: 2,
    before,
    after: finishShopping(before, "purchase", "now"),
  };
  const result = replayChange(before, change);
  assert.equal(result.products[0].quantity, 7);
  assert.equal(replayChange(result, change).products[0].quantity, 7);
});
test("conflictos de nombre, unidad o borrado no descartan datos silenciosamente", () => {
  const before = base(),
    after = base(),
    remote = base();
  after.products[0].name = "Integral";
  remote.products[0].name = "Otra marca";
  assert.throws(
    () => replayChange(remote, { id: "sync-3", createdAt: 3, before, after }),
    /cambios de otro integrante/,
  );
  assert.equal(remote.products[0].quantity, 1);
});
test("la cola sobrevive a la recarga, aísla usuarios y se limpia al salir", () => {
  const values = new Map<string, string>();
  const storage = {
    get length() {
      return values.size;
    },
    key: (i: number) => [...values.keys()][i] ?? null,
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
    removeItem: (k: string) => {
      values.delete(k);
    },
  };
  const change = { id: "sync-a", createdAt: 1, before: base(), after: base() };
  queueChange("user", "home", change, storage);
  assert.deepEqual(queuedChanges("user", "home", storage), [change]);
  assert.equal(queuedChanges("other", "home", storage).length, 0);
  acknowledgeChange("user", "home", change.id, storage);
  assert.equal(queuedChanges("user", "home", storage).length, 0);
  queueChange("user", "home", change, storage);
  storage.setItem("another-app", "keep");
  clearAppData(storage);
  assert.deepEqual([...values], [["another-app", "keep"]]);
});
