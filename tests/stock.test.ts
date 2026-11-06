import { test } from "node:test";
import assert from "node:assert/strict";
import { isLowStock, validateProduct } from "../src/services/stock.ts";
test("detecta stock menor, igual y mayor al mínimo", () => {
  assert.equal(isLowStock({ quantity: 0, minimumStock: 1 }), true);
  assert.equal(isLowStock({ quantity: 1, minimumStock: 1 }), true);
  assert.equal(isLowStock({ quantity: 2, minimumStock: 1 }), false);
});
test("cero y decimales se comparan correctamente", () => {
  assert.equal(isLowStock({ quantity: 0, minimumStock: 0 }), true);
  assert.equal(isLowStock({ quantity: 0.25, minimumStock: 0.5 }), true);
});
const valid = {
  name: "Arroz",
  category: "Almacén",
  quantity: 2,
  unit: "kg",
  minimumStock: 1,
} as const;
test("valida el producto y rechaza nombres vacíos, largos y cantidades inválidas", () => {
  assert.equal(validateProduct(valid), null);
  for (const quantity of [-1, NaN, Infinity, 100001])
    assert.ok(validateProduct({ ...valid, quantity }));
  for (const name of ["", "   ", "a".repeat(81)])
    assert.ok(validateProduct({ ...valid, name }));
  assert.ok(validateProduct({ ...valid, minimumStock: -1 }));
});
