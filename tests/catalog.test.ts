import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addCatalogProducts,
  productCatalog,
  starterKeys,
} from "../src/services/productCatalog.ts";
import { emptyHousehold } from "../src/services/cloudState.ts";
import { validateProduct } from "../src/services/stock.ts";
import { shoppingRows } from "../src/services/shopping.ts";
test("carga los cuatro básicos elegidos en cero y genera sus faltantes", () => {
  const original = emptyHousehold();
  const result = addCatalogProducts(original, starterKeys, "now");
  assert.equal(result.products.length, 4);
  assert.equal(original.products.length, 0);
  assert.ok(
    result.products.every(
      (p) => p.quantity === 0 && validateProduct(p) === null,
    ),
  );
  assert.equal(shoppingRows(result).length, 4);
  assert.deepEqual(addCatalogProducts(result, starterKeys, "later"), result);
});
test("evita duplicados con mayúsculas, tildes o espacios y conserva el stock existente", () => {
  const state = emptyHousehold();
  state.products.push({
    id: "own",
    name: "  JABON  ",
    category: "Higiene",
    unit: "un",
    quantity: 7,
    minimumStock: 2,
    updatedAt: "before",
  });
  const next = addCatalogProducts(state, ["jabon", "jabon", "arroz"], "now");
  assert.equal(next.products.length, 2);
  assert.deepEqual(next.products[0], state.products[0]);
});
test("un básico renombrado conserva su identidad y no se sobrescribe al repetir la carga", () => {
  const state = addCatalogProducts(emptyHousehold(), ["arroz"], "now");
  state.products[0].name = "Arroz integral";
  state.products[0].quantity = 5;
  assert.equal(addCatalogProducts(state, ["arroz"], "later"), state);
});
test("todo el catálogo es válido y una selección desconocida se rechaza sin cambios parciales", () => {
  const state = emptyHousehold();
  const all = addCatalogProducts(
    state,
    productCatalog.map((p) => p.key),
    "now",
  );
  assert.equal(
    new Set(all.products.map((p) => p.id)).size,
    productCatalog.length,
  );
  assert.ok(all.products.every((p) => !validateProduct(p)));
  assert.throws(() =>
    addCatalogProducts(state, ["arroz", "inexistente"], "now"),
  );
  assert.equal(state.products.length, 0);
});
